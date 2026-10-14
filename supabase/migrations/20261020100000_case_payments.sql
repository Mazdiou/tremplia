-- Migration : case_payments
-- Ce que le candidat paie à l'agence, en dinars (montants entiers).
-- - campaigns.default_fee : tarif proposé à la création d'un dossier
-- - cases.agreed_amount : montant convenu avec le candidat (vide : pas encore
--   fixé). Un employé le fixe une première fois ; ensuite, seul le patron le
--   change, jamais en dessous de ce qui a déjà été payé.
-- - case_payments : paiements reçus. Jamais supprimés : le patron les annule
--   avec un motif. Le total payé ne dépasse jamais le montant convenu.
-- Lecture : membres actifs de l'agence (RLS).
-- Écriture : uniquement par les fonctions ci-dessous.

create function public.is_valid_amount(p_amount integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_amount between 0 and 999999999
$$;

alter table public.campaigns
  add column default_fee integer check (public.is_valid_amount(default_fee));

alter table public.cases
  add column agreed_amount integer check (public.is_valid_amount(agreed_amount));

create table public.case_payments (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,

  amount integer not null check (amount > 0 and public.is_valid_amount(amount)),
  paid_on date not null check (paid_on >= date '2000-01-01'),
  method text not null check (method in ('cash', 'transfer', 'ccp', 'cheque', 'card')),
  note text check (note is null or public.is_clean_text(note, 300)),

  created_by uuid not null,
  created_at timestamptz not null default now(),

  -- Annulation : qui, quand et pourquoi, tout ou rien
  cancelled_by uuid,
  cancelled_at timestamptz,
  cancel_reason text check (cancel_reason is null or public.is_clean_text(cancel_reason, 300)),

  -- Pas de cascade : un employé qui a saisi un paiement ne peut plus être
  -- supprimé (désactivation seulement), le paiement garde son auteur.
  constraint case_payments_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_payments_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id),
  constraint case_payments_cancelled_by_fk foreign key (cancelled_by, agency_id)
    references public.profiles (id, agency_id),
  constraint case_payments_cancel_complete check (
    (cancelled_at is null) = (cancelled_by is null)
    and (cancelled_at is null) = (cancel_reason is null)
  )
);

create index case_payments_case_idx on public.case_payments (case_id, paid_on desc);
create index case_payments_agency_idx on public.case_payments (agency_id, paid_on);
create index case_payments_created_by_idx on public.case_payments (created_by);
create index case_payments_cancelled_by_idx on public.case_payments (cancelled_by);

alter table public.case_payments enable row level security;

-- Fonctions (serveur seulement) ---------------------------------------------

-- Vérifie l'acteur, verrouille le dossier (les paiements simultanés se
-- suivent) et renvoie son rôle, le montant convenu et le total payé.
create function public.lock_case_payments(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  out role text,
  out agreed integer,
  out paid bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  role := public.require_active_member(p_actor_id, p_agency_id);

  select c.agreed_amount into agreed
  from public.cases c
  where c.id = p_case_id and c.agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0) into paid
  from public.case_payments
  where case_id = p_case_id and agency_id = p_agency_id and cancelled_at is null;
end;
$$;

-- Fixe ou change le montant convenu. Renvoie vrai s'il a changé.
create function public.set_case_agreed_amount(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_amount integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock record;
begin
  select * into v_lock from public.lock_case_payments(p_case_id, p_agency_id, p_actor_id);

  if p_amount is null or not public.is_valid_amount(p_amount) then
    raise exception 'Montant invalide' using errcode = '23514';
  end if;
  if v_lock.agreed is not distinct from p_amount then
    return false;
  end if;
  if v_lock.agreed is not null and v_lock.role <> 'owner' then
    raise exception 'Seul le patron modifie le montant convenu' using errcode = '42501';
  end if;
  if p_amount < v_lock.paid then
    raise exception 'Le montant convenu ne peut pas être inférieur au total déjà payé'
      using errcode = '22003';
  end if;

  update public.cases set agreed_amount = p_amount
  where id = p_case_id and agency_id = p_agency_id;
  return true;
end;
$$;

-- Enregistre un paiement reçu (tout membre actif), dans la limite du reste
-- à payer.
create function public.record_case_payment(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_amount integer,
  p_paid_on date,
  p_method text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock record;
  v_id uuid;
begin
  select * into v_lock from public.lock_case_payments(p_case_id, p_agency_id, p_actor_id);

  if v_lock.agreed is null then
    raise exception 'Indiquez d''abord le montant convenu' using errcode = '55000';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > v_lock.agreed - v_lock.paid then
    raise exception 'Le paiement dépasse le reste à payer' using errcode = '22003';
  end if;
  -- Pas de date future (fuseau de l'application)
  if p_paid_on is null or p_paid_on > (now() at time zone 'Africa/Algiers')::date then
    raise exception 'Date de paiement invalide' using errcode = '22007';
  end if;
  if (select count(*) from public.case_payments where case_id = p_case_id) >= 200 then
    raise exception 'Limite de 200 paiements par dossier atteinte' using errcode = '54000';
  end if;

  insert into public.case_payments (
    agency_id, case_id, amount, paid_on, method, note, created_by
  ) values (
    p_agency_id, p_case_id, p_amount, p_paid_on, p_method, p_note, p_actor_id
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Annule un paiement (patron seulement), avec un motif. Renvoie son montant.
create function public.cancel_case_payment(
  p_payment_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock record;
  v_amount integer;
begin
  select * into v_lock from public.lock_case_payments(p_case_id, p_agency_id, p_actor_id);
  if v_lock.role <> 'owner' then
    raise exception 'Seul le patron annule un paiement' using errcode = '42501';
  end if;

  update public.case_payments
  set cancelled_by = p_actor_id,
      cancelled_at = now(),
      cancel_reason = p_reason
  where id = p_payment_id
    and case_id = p_case_id
    and agency_id = p_agency_id
    and cancelled_at is null
  returning amount into v_amount;
  if found then
    return v_amount;
  end if;

  if exists (
    select 1 from public.case_payments
    where id = p_payment_id and case_id = p_case_id and agency_id = p_agency_id
  ) then
    raise exception 'Ce paiement est déjà annulé' using errcode = '55000';
  end if;
  raise exception 'Paiement introuvable' using errcode = 'P0002';
end;
$$;

-- Création d'un dossier : montant convenu et premier paiement --------------
-- Mêmes étapes qu'avant, plus deux paramètres facultatifs, dans la même
-- transaction :
-- - p_agreed_amount : montant convenu (tout membre)
-- - p_initial_payment : { "amount", "method" }, payé le jour même

drop function public.create_case(uuid, uuid, uuid, uuid, uuid, jsonb, uuid[], jsonb, text);

create function public.create_case(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_campaign_id uuid,
  p_assigned_to uuid,
  p_fields jsonb,
  p_group_ids uuid[],
  p_accounts jsonb,
  p_initial_note text,
  p_agreed_amount integer default null,
  p_initial_payment jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_case public.cases;
  v_account jsonb;
begin
  v_role := public.require_active_member(p_actor_id, p_agency_id);

  if v_role <> 'owner' and p_assigned_to is distinct from p_actor_id then
    raise exception 'Seul le patron choisit le responsable d''un dossier'
      using errcode = '42501';
  end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.profiles
    where id = p_assigned_to and agency_id = p_agency_id and is_active
  ) then
    raise exception 'Responsable invalide' using errcode = '22023';
  end if;

  perform public.assert_case_fields(p_fields);
  if jsonb_typeof(coalesce(p_accounts, '[]')) <> 'array'
     or jsonb_array_length(coalesce(p_accounts, '[]')) > 10 then
    raise exception 'Comptes externes invalides' using errcode = '22023';
  end if;
  if p_initial_payment is not null and p_agreed_amount is null then
    raise exception 'Indiquez d''abord le montant convenu' using errcode = '55000';
  end if;

  v_case := jsonb_populate_record(null::public.cases, p_fields);

  insert into public.cases (
    id, agency_id, campaign_id, created_by, assigned_to,
    first_name, last_name, birth_date, phone, email, city, nationality,
    secondary_contact_name, secondary_contact_phone,
    education_level, current_field, current_institution, diplomas, language_tests,
    agreed_amount
  ) values (
    p_case_id, p_agency_id, p_campaign_id, p_actor_id, p_assigned_to,
    v_case.first_name, v_case.last_name, v_case.birth_date, v_case.phone,
    v_case.email, v_case.city, v_case.nationality,
    v_case.secondary_contact_name, v_case.secondary_contact_phone,
    v_case.education_level, v_case.current_field, v_case.current_institution,
    coalesce(v_case.diplomas, '[]'), coalesce(v_case.language_tests, '[]'),
    p_agreed_amount
  );

  -- Les clés composites refusent un groupe d'une autre campagne ou agence
  insert into public.case_groups (case_id, group_id, agency_id, campaign_id)
  select distinct p_case_id, g, p_agency_id, p_campaign_id
  from unnest(coalesce(p_group_ids, '{}')) as g;

  for v_account in select value from jsonb_array_elements(coalesce(p_accounts, '[]'))
  loop
    perform public.save_external_account(
      (v_account ->> 'id')::uuid, p_case_id, p_agency_id, p_actor_id,
      v_account ->> 'platform', v_account ->> 'url', v_account ->> 'login',
      v_account ->> 'status', v_account ->> 'password_encrypted',
      coalesce((v_account ->> 'key_version')::smallint, 1::smallint)
    );
  end loop;

  -- create_case_note est définie par la migration case_notes (résolue à
  -- l'exécution) : la note suit les mêmes règles que toutes les autres.
  if p_initial_note is not null then
    perform public.create_case_note(p_case_id, p_agency_id, p_actor_id, p_initial_note);
  end if;

  if p_initial_payment is not null then
    perform public.record_case_payment(
      p_case_id, p_agency_id, p_actor_id,
      (p_initial_payment ->> 'amount')::integer,
      (now() at time zone 'Africa/Algiers')::date,
      p_initial_payment ->> 'method',
      null
    );
  end if;

  return p_case_id;
end;
$$;

-- Campagnes : tarif par défaut ----------------------------------------------

drop function public.create_campaign(uuid, uuid, text, text, text[], jsonb, jsonb, text[]);

create function public.create_campaign(
  p_agency_id uuid,
  p_actor_id uuid,
  p_name text,
  p_template_key text,
  p_suggested_platforms text[],
  p_dates jsonb,
  p_infos jsonb,
  p_groups text[],
  p_default_fee integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  if cardinality(coalesce(p_groups, '{}')) > 30 then
    raise exception 'Trop de groupes' using errcode = '22023';
  end if;

  insert into public.campaigns (
    agency_id, name, template_key, suggested_platforms, default_fee, created_by
  ) values (
    p_agency_id, p_name, p_template_key, coalesce(p_suggested_platforms, '{}'),
    p_default_fee, p_actor_id
  )
  returning id into v_id;

  perform public.replace_campaign_details(v_id, p_agency_id, p_dates, p_infos);

  insert into public.campaign_groups (agency_id, campaign_id, name, position, created_by)
  select p_agency_id, v_id, g.name, (g.ordinality - 1)::integer, p_actor_id
  from unnest(coalesce(p_groups, '{}')) with ordinality as g(name, ordinality);

  return v_id;
end;
$$;

drop function public.update_campaign(uuid, uuid, uuid, text, text[], jsonb, jsonb);

create function public.update_campaign(
  p_campaign_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_name text,
  p_suggested_platforms text[],
  p_dates jsonb,
  p_infos jsonb,
  p_default_fee integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  perform 1 from public.campaigns
  where id = p_campaign_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;
  perform public.assert_campaign_active(p_campaign_id);

  update public.campaigns
  set name = p_name,
      suggested_platforms = coalesce(p_suggested_platforms, '{}'),
      default_fee = p_default_fee
  where id = p_campaign_id and agency_id = p_agency_id;

  perform public.replace_campaign_details(p_campaign_id, p_agency_id, p_dates, p_infos);
end;
$$;

-- Le tarif d'une campagne archivée est figé, comme ses autres réglages
create function public.campaigns_fee_frozen()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'archived' and new.status = 'archived'
     and new.default_fee is distinct from old.default_fee then
    raise exception 'Campagne archivée : réactivez-la d''abord'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger campaigns_fee_frozen
  before update of default_fee on public.campaigns
  for each row execute function public.campaigns_fee_frozen();

-- Droits --------------------------------------------------------------------

revoke execute on function public.is_valid_amount(integer) from public;
revoke execute on function public.lock_case_payments(uuid, uuid, uuid) from public;
revoke execute on function public.set_case_agreed_amount(uuid, uuid, uuid, integer) from public;
revoke execute on function public.record_case_payment(uuid, uuid, uuid, integer, date, text, text)
  from public;
revoke execute on function public.cancel_case_payment(uuid, uuid, uuid, uuid, text) from public;
revoke execute on function public.create_case(
  uuid, uuid, uuid, uuid, uuid, jsonb, uuid[], jsonb, text, integer, jsonb) from public;
revoke execute on function public.create_campaign(
  uuid, uuid, text, text, text[], jsonb, jsonb, text[], integer) from public;
revoke execute on function public.update_campaign(
  uuid, uuid, uuid, text, text[], jsonb, jsonb, integer) from public;
revoke execute on function public.campaigns_fee_frozen() from public;

-- Utilisée par les contraintes : même règle que is_clean_text
grant execute on function public.is_valid_amount(integer) to service_role;
grant execute on function public.set_case_agreed_amount(uuid, uuid, uuid, integer)
  to service_role;
grant execute on function public.record_case_payment(uuid, uuid, uuid, integer, date, text, text)
  to service_role;
grant execute on function public.cancel_case_payment(uuid, uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.create_case(
  uuid, uuid, uuid, uuid, uuid, jsonb, uuid[], jsonb, text, integer, jsonb) to service_role;
grant execute on function public.create_campaign(
  uuid, uuid, text, text, text[], jsonb, jsonb, text[], integer) to service_role;
grant execute on function public.update_campaign(
  uuid, uuid, uuid, text, text[], jsonb, jsonb, integer) to service_role;

-- Lecture seule : le serveur écrit seulement par les fonctions ci-dessus
grant select on public.case_payments to authenticated, service_role;

create policy "case_payments_select_same_agency" on public.case_payments
  for select to authenticated
  using (agency_id = public.current_agency_id());
