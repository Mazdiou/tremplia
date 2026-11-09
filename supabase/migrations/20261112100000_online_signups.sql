-- Migration : online_signups
-- Inscription en ligne. Le patron ouvre une page publique propre à son
-- agence (/inscription/<adresse>), à partager sur Facebook ou WhatsApp. Le
-- candidat y remplit ses informations et choisit une des campagnes que le
-- patron a ouvertes. Son envoi n'est pas un dossier : c'est une demande,
-- que l'équipe accepte (le dossier est alors créé avec le formulaire
-- habituel, prérempli) ou refuse (la demande est supprimée).
-- - Réglages (patron) : activer la page, choisir son adresse et les
--   campagnes ouvertes.
-- - Envoi du candidat : par le serveur, qui a déjà validé les champs.
--   Essais limités par adresse IP (empreinte seulement) et par agence ; une
--   même personne n'a qu'une demande en attente.
-- - Lecture : membres actifs de l'agence (RLS). Accepter ou refuser : tout
--   membre actif, par les fonctions ci-dessous.
-- - Une demande restée sans réponse est supprimée après 90 jours.
-- - Abonnement expiré : la page publique se ferme, rien ne s'écrit.

-- 1. Réglages de l'agence et des campagnes -------------------------------------

alter table public.agencies
  add column signup_enabled boolean not null default false,
  -- Adresse de la page : minuscules, chiffres et tirets, 3 à 50 caractères
  add column signup_slug text unique
    check (signup_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(signup_slug) between 3 and 50),
  add constraint agencies_signup_slug_required
    check (not signup_enabled or signup_slug is not null);

alter table public.campaigns
  -- Proposée sur la page d'inscription en ligne (campagnes actives seulement)
  add column signup_open boolean not null default false;

-- 2. Demandes reçues -------------------------------------------------------------

-- Champs d'une demande : ceux du dossier (assert_case_fields), les
-- obligatoires présents. Le détail est validé par le serveur ; le dossier
-- créé à partir de la demande passe ensuite par toutes les règles de cases.
create function public.is_signup_fields(p_fields jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_fields) = 'object'
    and length(p_fields::text) <= 20000
    and not exists (
      select 1 from jsonb_object_keys(p_fields) as k
      where k <> all (array[
        'first_name', 'last_name', 'birth_date', 'phone', 'email', 'city',
        'nationality', 'secondary_contact_name', 'secondary_contact_phone',
        'education_level', 'current_field', 'current_institution', 'diplomas',
        'language_tests'
      ])
    )
    -- Champ absent : « inconnu », compté comme faux (bool_and ignore les
    -- valeurs inconnues)
    and (
      select bool_and(coalesce(jsonb_typeof(p_fields -> k) = 'string'
                               and btrim(p_fields ->> k) <> '', false))
      from unnest(array['first_name', 'last_name', 'birth_date', 'phone',
                        'education_level']) as k
    )
$$;

create table public.online_signups (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- Campagne choisie (vide si elle a été supprimée depuis)
  campaign_id uuid,
  fields jsonb not null check (public.is_signup_fields(fields)),
  -- Message libre du candidat
  message text check (message ~ '\S' and length(message) <= 1000),
  -- Nom comparable (doublons, tri)
  search_name text generated always as
    (public.normalize_name((fields ->> 'last_name') || ' ' || (fields ->> 'first_name'))) stored,
  created_at timestamptz not null default now(),

  constraint online_signups_campaign_fk foreign key (campaign_id, agency_id)
    references public.campaigns (id, agency_id) on delete set null (campaign_id)
);

create index online_signups_agency_idx on public.online_signups (agency_id, created_at);
create index online_signups_campaign_idx on public.online_signups (campaign_id);
create index online_signups_created_at_idx on public.online_signups (created_at);

-- Rien ne se modifie : une demande s'accepte ou se refuse
create function public.online_signups_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Seule la campagne peut devenir vide (campagne supprimée)
  if new.campaign_id is null and old.campaign_id is not null
     and new.id = old.id and new.agency_id = old.agency_id
     and new.fields = old.fields
     and new.message is not distinct from old.message
     and new.created_at = old.created_at then
    return new;
  end if;
  raise exception 'Une demande d''inscription ne se modifie pas' using errcode = '42501';
end;
$$;

create trigger online_signups_before_update
  before update on public.online_signups
  for each row execute function public.online_signups_before_update();

-- Essais d'envoi, pour les limites (adresse en empreinte seulement)
create table public.online_signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  -- Vide si l'adresse de la page ne correspondait à aucune agence
  agency_id uuid references public.agencies (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index online_signup_attempts_ip_idx
  on public.online_signup_attempts (ip_hash, attempted_at);
create index online_signup_attempts_agency_idx
  on public.online_signup_attempts (agency_id, attempted_at);
create index online_signup_attempts_attempted_at_idx
  on public.online_signup_attempts (attempted_at);

alter table public.online_signups enable row level security;
-- Aucune politique : seul le serveur y accède, par les fonctions ci-dessous
alter table public.online_signup_attempts enable row level security;

-- Abonnement expiré : lecture seule, comme les autres données de l'agence
create trigger online_signups_writable
  before insert or update or delete on public.online_signups
  for each row execute function public.enforce_agency_writable();

-- 3. Réglages (patron, serveur seulement) -----------------------------------------

-- Active ou ferme la page, change son adresse et les campagnes proposées
-- (parmi les campagnes actives de l'agence). Adresse déjà prise : 23505.
create function public.save_signup_settings(
  p_agency_id uuid,
  p_actor_id uuid,
  p_enabled boolean,
  p_slug text,
  p_campaign_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);
  perform public.require_writable_agency(p_agency_id);

  if exists (
    select 1 from unnest(coalesce(p_campaign_ids, '{}')) as c(id)
    where not exists (select 1 from public.campaigns k
                      where k.id = c.id and k.agency_id = p_agency_id
                        and k.status = 'active')
  ) then
    raise exception 'Campagne introuvable ou archivée' using errcode = '22023';
  end if;

  update public.agencies
  set signup_enabled = coalesce(p_enabled, false),
      signup_slug = p_slug
  where id = p_agency_id;

  update public.campaigns
  set signup_open = (id = any(coalesce(p_campaign_ids, '{}')))
  where agency_id = p_agency_id
    and status = 'active'
    and signup_open is distinct from (id = any(coalesce(p_campaign_ids, '{}')));
end;
$$;

-- 4. Page publique et envoi du candidat (serveur seulement) -------------------------

-- Ce que montre la page d'une adresse : l'agence, si la page est ouverte
-- (activée, abonnement en cours, au moins une campagne), et ses campagnes
-- ouvertes. Aucune ligne : adresse inconnue.
create function public.online_signup_page(p_slug text)
returns table (
  agency_id uuid,
  agency_name text,
  agency_city text,
  agency_phone text,
  is_open boolean,
  campaigns jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.name, a.city, a.phone,
    a.signup_enabled
      and (a.subscription_ends_at > now() or public.agency_is_exempt(a.id))
      and c.list <> '[]'::jsonb,
    c.list
  from public.agencies a
  cross join lateral (
    select coalesce(jsonb_agg(jsonb_build_object('id', k.id, 'name', k.name)
                              order by k.created_at, k.id), '[]'::jsonb) as list
    from public.campaigns k
    where k.agency_id = a.id and k.status = 'active' and k.signup_open
  ) c
  where a.signup_slug = p_slug
$$;

-- Compte un essai d'envoi, ou le refuse (54000) si la limite est atteinte :
-- 5 par heure et par adresse IP, 60 par heure et par agence. Appelée avant
-- l'envoi, dans sa propre transaction : un envoi refusé plus loin (page
-- fermée, doublon…) compte aussi, et une adresse de page ne se devine pas
-- en essayant.
create function public.online_signup_attempt(p_slug text, p_ip_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid;
begin
  delete from public.online_signup_attempts
  where attempted_at < now() - interval '1 day';

  select a.id into v_agency
  from public.agencies a
  where a.signup_slug = p_slug;

  if (select count(*) from public.online_signup_attempts t
      where t.ip_hash = p_ip_hash
        and t.attempted_at > now() - interval '1 hour') >= 5
     or (v_agency is not null and (
           select count(*) from public.online_signup_attempts t
           where t.agency_id = v_agency
             and t.attempted_at > now() - interval '1 hour') >= 60) then
    raise exception 'Trop d''envois' using errcode = '54000';
  end if;

  insert into public.online_signup_attempts (ip_hash, agency_id)
  values (p_ip_hash, v_agency);
end;
$$;

-- Enregistre la demande d'un candidat (essai déjà compté par
-- online_signup_attempt). Renvoie son identifiant et l'agence.
-- - P0002 : adresse inconnue ou page fermée ; 25006 : abonnement expiré ;
-- - 22023 : campagne qui n'est plus proposée ;
-- - 54000 : 500 demandes en attente au plus par agence ;
-- - 23505 : une demande à ce nom et cette date de naissance attend déjà.
create function public.submit_online_signup(
  p_slug text,
  p_campaign_id uuid,
  p_fields jsonb,
  p_message text
)
returns table (signup_id uuid, agency_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency uuid;
  v_enabled boolean;
  v_id uuid;
begin
  select a.id, a.signup_enabled into v_agency, v_enabled
  from public.agencies a
  where a.signup_slug = p_slug;

  if v_agency is null or not v_enabled then
    raise exception 'Inscriptions fermées' using errcode = 'P0002';
  end if;
  perform public.require_writable_agency(v_agency);

  if not exists (
    select 1 from public.campaigns k
    where k.id = p_campaign_id and k.agency_id = v_agency
      and k.status = 'active' and k.signup_open
  ) then
    raise exception 'Campagne fermée aux inscriptions' using errcode = '22023';
  end if;

  if not public.is_signup_fields(p_fields) then
    raise exception 'Champs invalides' using errcode = '22023';
  end if;

  -- Demandes sans réponse depuis 90 jours : oubliées
  delete from public.online_signups s
  where s.agency_id = v_agency and s.created_at < now() - interval '90 days';

  -- Verrou de l'agence : deux envois simultanés ne dépassent pas la limite
  -- et ne créent pas deux fois la même demande
  perform 1 from public.agencies where id = v_agency for no key update;

  if (select count(*) from public.online_signups s where s.agency_id = v_agency) >= 500 then
    raise exception 'Trop de demandes en attente' using errcode = '54000';
  end if;

  if exists (
    select 1 from public.online_signups s
    where s.agency_id = v_agency
      and s.search_name = public.normalize_name(
            (p_fields ->> 'last_name') || ' ' || (p_fields ->> 'first_name'))
      and s.fields ->> 'birth_date' = p_fields ->> 'birth_date'
  ) then
    raise exception 'Demande déjà envoyée' using errcode = '23505';
  end if;

  insert into public.online_signups (agency_id, campaign_id, fields, message)
  values (v_agency, p_campaign_id, p_fields, p_message)
  returning id into v_id;

  return query select v_id, v_agency;
end;
$$;

-- 5. Réponse de l'agence (serveur seulement) -----------------------------------------

-- Refuser une demande : tout membre actif. Elle est supprimée.
create function public.delete_online_signup(
  p_signup_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  delete from public.online_signups
  where id = p_signup_id and agency_id = p_agency_id;
  if not found then
    raise exception 'Demande introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Accepter : création du dossier, même fonction qu'avant avec la demande
-- en plus (p_signup_id), supprimée dans la même transaction. Une demande
-- déjà traitée (par un collègue) : P0002, rien n'est créé.
drop function public.create_case(
  uuid, uuid, uuid, uuid, uuid, jsonb, uuid[], jsonb, text, integer, jsonb);

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
  p_initial_payment jsonb default null,
  p_signup_id uuid default null
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

  if p_signup_id is not null then
    delete from public.online_signups
    where id = p_signup_id and agency_id = p_agency_id;
    if not found then
      raise exception 'Demande déjà traitée' using errcode = 'P0002';
    end if;
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

-- 6. Demandes oubliées après 90 jours (tâche quotidienne) ----------------------------

-- Toutes agences, abonnement expiré compris (comme les autres purges).
-- Renvoie le nombre de demandes supprimées.
create function public.purge_old_online_signups()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform set_config('tremplia.purge', 'on', true);
  delete from public.online_signups where created_at < now() - interval '90 days';
  get diagnostics v_count = row_count;
  perform set_config('tremplia.purge', 'off', true);
  return v_count;
end;
$$;

-- 7. Notifications : nouvelle demande reçue --------------------------------------------

alter table public.notification_preferences
  -- Nouvelle demande d'inscription en ligne (toute l'équipe)
  add column online_signups boolean not null default true;

-- Nouveau choix, facultatif : vide, il garde la valeur enregistrée
drop function public.save_notification_preferences(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean);
create function public.save_notification_preferences(
  p_agency_id uuid,
  p_user_id uuid,
  p_student_messages boolean,
  p_student_reviews boolean,
  p_assigned_tasks boolean,
  p_daily_tasks boolean,
  p_student_documents boolean default null,
  p_online_signups boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.agency_id = p_agency_id and p.is_active
  ) then
    raise exception 'Membre introuvable' using errcode = '42501';
  end if;

  insert into public.notification_preferences
    (user_id, agency_id, student_messages, student_reviews, assigned_tasks, daily_tasks,
     student_documents, online_signups)
  values (p_user_id, p_agency_id, coalesce(p_student_messages, true),
    coalesce(p_student_reviews, true), coalesce(p_assigned_tasks, true),
    coalesce(p_daily_tasks, false), coalesce(p_student_documents, true),
    coalesce(p_online_signups, true))
  on conflict (user_id) do update set
    student_messages = excluded.student_messages,
    student_reviews = excluded.student_reviews,
    assigned_tasks = excluded.assigned_tasks,
    daily_tasks = excluded.daily_tasks,
    student_documents = coalesce(p_student_documents,
      public.notification_preferences.student_documents),
    online_signups = coalesce(p_online_signups,
      public.notification_preferences.online_signups),
    updated_at = now();
end;
$$;

-- Appareils des membres actifs de l'agence qui veulent être prévenus d'une
-- nouvelle demande
create function public.push_targets_online_signup(p_agency_id uuid)
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.endpoint, s.p256dh, s.auth
  from public.profiles p
  join public.push_subscriptions s on s.user_id = p.id
  left join public.notification_preferences n on n.user_id = p.id
  where p.agency_id = p_agency_id
    and p.is_active and not p.must_change_password
    and coalesce(n.online_signups, true)
$$;

-- 8. Temps réel : l'agence voit arriver (et partir) les demandes --------------------

-- Identité complète : une demande supprimée arrive aussi, filtrée par agence
alter table public.online_signups replica identity full;
alter publication supabase_realtime add table public.online_signups;

-- Droits ---------------------------------------------------------------------------

revoke execute on function public.is_signup_fields(jsonb) from public;
revoke execute on function public.online_signups_before_update() from public;
revoke execute on function public.save_signup_settings(uuid, uuid, boolean, text, uuid[]) from public;
revoke execute on function public.online_signup_page(text) from public;
revoke execute on function public.online_signup_attempt(text, text) from public;
revoke execute on function public.submit_online_signup(text, uuid, jsonb, text) from public;
revoke execute on function public.delete_online_signup(uuid, uuid, uuid) from public;
revoke execute on function public.create_case(
  uuid, uuid, uuid, uuid, uuid, jsonb, uuid[], jsonb, text, integer, jsonb, uuid) from public;
revoke execute on function public.purge_old_online_signups() from public;
revoke execute on function public.save_notification_preferences(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean) from public;
revoke execute on function public.push_targets_online_signup(uuid) from public;

-- Utilisée par la contrainte de la table : même règle que is_clean_text
grant execute on function public.is_signup_fields(jsonb) to service_role;
grant execute on function public.save_signup_settings(uuid, uuid, boolean, text, uuid[])
  to service_role;
grant execute on function public.online_signup_page(text) to service_role;
grant execute on function public.online_signup_attempt(text, text) to service_role;
grant execute on function public.submit_online_signup(text, uuid, jsonb, text) to service_role;
grant execute on function public.delete_online_signup(uuid, uuid, uuid) to service_role;
grant execute on function public.create_case(
  uuid, uuid, uuid, uuid, uuid, jsonb, uuid[], jsonb, text, integer, jsonb, uuid) to service_role;
grant execute on function public.purge_old_online_signups() to service_role;
grant execute on function public.save_notification_preferences(
  uuid, uuid, boolean, boolean, boolean, boolean, boolean, boolean) to service_role;
grant execute on function public.push_targets_online_signup(uuid) to service_role;

-- Lecture : l'agence (RLS) et le serveur. Toute écriture passe par les
-- fonctions.
grant select on public.online_signups to authenticated, service_role;

create policy "online_signups_select_same_agency" on public.online_signups
  for select to authenticated
  using (agency_id = public.current_agency_id());
