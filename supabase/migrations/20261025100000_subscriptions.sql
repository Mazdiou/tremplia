-- Migration : subscriptions
-- Abonnement des agences (StudyFlow vendu en SaaS, payé en espèces ou par
-- CCP / BaridiMob, validé à la main par l'administrateur de la plateforme).
--
-- - Chaque agence a une date de fin d'abonnement. Une nouvelle agence a
--   7 jours d'essai ; les agences existantes reçoivent un an.
-- - Après cette date, l'agence est en LECTURE SEULE : tout reste lisible,
--   mais la base refuse toute écriture sur ses données (déclencheurs sur
--   chaque table, donc quel que soit le chemin de l'écriture). Le journal
--   d'activité et les marques « message lu » restent permis : ce sont des
--   traces de lecture.
-- - L'administrateur de la plateforme est désigné à la main dans la table
--   platform_admins (aucun écran ne permet de le devenir). Lui seul
--   enregistre les paiements, qui allongent l'abonnement.

-- 1. Date de fin ------------------------------------------------------------

alter table public.agencies
  add column subscription_ends_at timestamptz not null
    default (now() + interval '7 days');

-- Agences déjà inscrites : un an, personne n'est bloqué du jour au lendemain
update public.agencies set subscription_ends_at = now() + interval '1 year';

-- 2. Administrateurs de la plateforme --------------------------------------

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Aucune politique : lu par le serveur seulement
alter table public.platform_admins enable row level security;
grant select on public.platform_admins to service_role;

create function public.require_platform_admin(p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.platform_admins where user_id = p_user_id) then
    raise exception 'Réservé à l''administrateur de la plateforme' using errcode = '42501';
  end if;
end;
$$;

-- 3. Paiements des agences --------------------------------------------------

create table public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  months integer not null check (months in (1, 3, 12)),
  amount integer not null check (amount > 0 and public.is_valid_amount(amount)),
  method text not null check (method in ('cash', 'ccp', 'baridimob')),
  note text check (note is null or public.is_clean_text(note, 300)),
  -- Fin d'abonnement avant et après ce paiement (une annulation revient à
  -- la première)
  previous_ends_at timestamptz not null,
  new_ends_at timestamptz not null check (new_ends_at > previous_ends_at),
  recorded_by uuid references auth.users (id) on delete set null,
  recorded_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users (id) on delete set null,
  cancel_reason text check (cancel_reason is null or public.is_clean_text(cancel_reason, 300)),
  constraint platform_payments_cancel_complete
    check ((cancelled_at is null) = (cancel_reason is null))
);

create index platform_payments_agency_idx
  on public.platform_payments (agency_id, recorded_at desc);

alter table public.platform_payments enable row level security;
grant select on public.platform_payments to authenticated, service_role;

-- Le patron voit les paiements de son agence (encart de la page Équipe)
create policy "platform_payments_select_owner" on public.platform_payments
  for select to authenticated
  using (agency_id = public.current_agency_id() and public.is_owner());

-- 4. État de l'abonnement ---------------------------------------------------

-- trial : jamais payé ; active : au moins un paiement non annulé ;
-- expired : date de fin passée (quel que soit l'historique)
create function public.agency_subscription(p_agency_id uuid)
returns table (ends_at timestamptz, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.subscription_ends_at,
    case
      when a.subscription_ends_at <= now() then 'expired'
      when exists (select 1 from public.platform_payments p
                   where p.agency_id = a.id and p.cancelled_at is null) then 'active'
      else 'trial'
    end
  from public.agencies a
  where a.id = p_agency_id
$$;

-- Lecture seule : refuse toute écriture d'une agence dont l'abonnement est
-- terminé. Code 25006 (« transaction en lecture seule »).
create function public.require_writable_agency(p_agency_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.agencies
             where id = p_agency_id and subscription_ends_at <= now()) then
    raise exception 'Abonnement expiré : agence en lecture seule' using errcode = '25006';
  end if;
end;
$$;

create function public.enforce_agency_writable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.require_writable_agency(old.agency_id);
    return old;
  end if;
  perform public.require_writable_agency(new.agency_id);
  return new;
end;
$$;

-- Toutes les données d'une agence, sauf le journal d'activité et les
-- marques de lecture des messages
do $$
declare
  t text;
begin
  foreach t in array array[
    'campaigns', 'campaign_dates', 'campaign_infos', 'campaign_groups',
    'cases', 'case_groups', 'case_external_accounts', 'external_account_secrets',
    'case_notes', 'case_motivation_letters', 'case_programs', 'case_payments',
    'case_student_access', 'case_student_reviews', 'case_messages',
    'documents', 'document_folders'
  ] loop
    execute format(
      'create trigger %I before insert or update or delete on public.%I
         for each row execute function public.enforce_agency_writable()',
      t || '_writable', t);
  end loop;
end;
$$;

-- Équipe : ajouter, (dés)activer, renommer ou supprimer un membre. Le
-- remplacement du mot de passe temporaire reste permis : un employé doit
-- pouvoir se connecter pour consulter.
create trigger profiles_writable
  before insert or delete or update of agency_id, first_name, last_name, role, is_active
  on public.profiles
  for each row execute function public.enforce_agency_writable();

-- 5. Paiements : enregistrer et annuler (administrateur seulement) ----------

-- La durée s'ajoute à la fin en cours si l'abonnement court encore, sinon à
-- partir de maintenant. Renvoie la nouvelle date de fin.
create function public.record_platform_payment(
  p_admin_id uuid,
  p_agency_id uuid,
  p_months integer,
  p_amount integer,
  p_method text,
  p_note text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous timestamptz;
  v_new timestamptz;
begin
  perform public.require_platform_admin(p_admin_id);

  select subscription_ends_at into v_previous
  from public.agencies where id = p_agency_id
  for update;
  if not found then
    raise exception 'Agence introuvable' using errcode = 'P0002';
  end if;

  v_new := greatest(v_previous, now()) + make_interval(months => p_months);

  insert into public.platform_payments (
    agency_id, months, amount, method, note, previous_ends_at, new_ends_at, recorded_by
  ) values (
    p_agency_id, p_months, p_amount, p_method, p_note, v_previous, v_new, p_admin_id
  );

  update public.agencies set subscription_ends_at = v_new where id = p_agency_id;
  return v_new;
end;
$$;

-- Annuler le DERNIER paiement non annulé d'une agence (erreur de saisie) :
-- la fin d'abonnement revient à ce qu'elle était avant lui. Renvoie la date
-- de fin rétablie.
create function public.cancel_platform_payment(
  p_admin_id uuid,
  p_payment_id uuid,
  p_reason text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid;
  v_previous timestamptz;
  v_cancelled timestamptz;
begin
  perform public.require_platform_admin(p_admin_id);

  if p_reason is null or not public.is_clean_text(p_reason, 300) or btrim(p_reason) = '' then
    raise exception 'Motif obligatoire' using errcode = '23514';
  end if;

  select agency_id, previous_ends_at, cancelled_at
  into v_agency, v_previous, v_cancelled
  from public.platform_payments where id = p_payment_id;
  if not found then
    raise exception 'Paiement introuvable' using errcode = 'P0002';
  end if;
  if v_cancelled is not null then
    raise exception 'Paiement déjà annulé' using errcode = '55000';
  end if;

  perform 1 from public.agencies where id = v_agency for update;

  -- Le dernier paiement est celui qui mène le plus loin : chaque paiement
  -- part de la fin laissée par le précédent, les fins vont en croissant
  -- (plus sûr que l'heure, identique dans une même transaction)
  if exists (select 1 from public.platform_payments
             where agency_id = v_agency and cancelled_at is null
               and id <> p_payment_id
               and new_ends_at > (select new_ends_at from public.platform_payments
                                  where id = p_payment_id)) then
    raise exception 'Seul le dernier paiement peut être annulé' using errcode = '55000';
  end if;

  update public.platform_payments
  set cancelled_at = now(), cancelled_by = p_admin_id, cancel_reason = btrim(p_reason)
  where id = p_payment_id;

  update public.agencies set subscription_ends_at = v_previous where id = v_agency;
  return v_previous;
end;
$$;

-- 6. Liste des agences pour l'administrateur --------------------------------

create function public.platform_agencies(p_admin_id uuid)
returns table (
  id uuid,
  name text,
  city text,
  phone text,
  owner_first_name text,
  owner_last_name text,
  created_at timestamptz,
  ends_at timestamptz,
  state text,
  cases bigint,
  members bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_platform_admin(p_admin_id);
  return query
  select a.id, a.name, a.city, a.phone, o.first_name, o.last_name, a.created_at,
    s.ends_at, s.state,
    (select count(*) from public.cases c where c.agency_id = a.id),
    (select count(*) from public.profiles p where p.agency_id = a.id and p.is_active)
  from public.agencies a
  cross join lateral public.agency_subscription(a.id) s
  left join lateral (
    select p.first_name, p.last_name from public.profiles p
    where p.agency_id = a.id and p.role = 'owner'
    limit 1
  ) o on true
  order by s.ends_at;
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on function public.require_platform_admin(uuid) from public;
revoke execute on function public.agency_subscription(uuid) from public;
revoke execute on function public.require_writable_agency(uuid) from public;
revoke execute on function public.enforce_agency_writable() from public;
revoke execute on function public.record_platform_payment(uuid, uuid, integer, integer, text, text)
  from public;
revoke execute on function public.cancel_platform_payment(uuid, uuid, text) from public;
revoke execute on function public.platform_agencies(uuid) from public;

grant execute on function public.agency_subscription(uuid) to service_role;
grant execute on function public.record_platform_payment(uuid, uuid, integer, integer, text, text)
  to service_role;
grant execute on function public.cancel_platform_payment(uuid, uuid, text) to service_role;
grant execute on function public.platform_agencies(uuid) to service_role;
