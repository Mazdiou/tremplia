-- Migration : cases
-- Dossiers candidats, leur classement dans les groupes de leur campagne, et
-- leurs comptes sur des plateformes externes (mots de passe CHIFFRÉS par le
-- serveur, dans une table que personne d'autre ne lit).
-- Lecture : membres actifs de l'agence (RLS), sauf les secrets.
-- Écriture : uniquement par les fonctions ci-dessous (routes serveur).
-- Un dossier n'est jamais supprimé et ne change jamais de campagne.

create extension if not exists unaccent with schema extensions;

-- Nom comparable : minuscules, sans accents ni espaces multiples
-- (« Éloïse  DUPONT » → « eloise dupont »). Sert à la recherche par nom.
-- Le dictionnaire est nommé explicitement : la fonction peut alors être
-- déclarée immuable et servir dans une colonne générée.
create function public.normalize_name(p_value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(regexp_replace(
    btrim(extensions.unaccent('extensions.unaccent'::regdictionary, p_value)),
    '\s+', ' ', 'g'))
$$;

-- Liste JSON d'objets, de p_max éléments au plus. Le détail de chaque objet
-- est validé par le serveur (zod) ; sa forme est décrite sur chaque colonne.
create function public.is_json_object_list(p_value jsonb, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_value) = 'array'
    and jsonb_array_length(p_value) <= p_max
    and not jsonb_path_exists(p_value, '$[*] ? (@.type() != "object")')
$$;

-- Dossiers ------------------------------------------------------------------

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  campaign_id uuid not null,
  created_by uuid not null,
  assigned_to uuid,

  -- Identité
  first_name text not null check (public.is_clean_text(first_name, 100)),
  last_name text not null check (public.is_clean_text(last_name, 100)),
  birth_date date not null check (birth_date > date '1900-01-01'),
  phone text not null check (public.is_clean_text(phone, 30) and length(phone) >= 6),
  email text check (public.is_clean_text(email, 254) and email like '%_@_%'),
  city text check (public.is_clean_text(city, 100)),
  nationality text check (public.is_clean_text(nationality, 100)),
  secondary_contact_name text check (public.is_clean_text(secondary_contact_name, 100)),
  secondary_contact_phone text check (
    public.is_clean_text(secondary_contact_phone, 30)
    and length(secondary_contact_phone) >= 6
  ),

  -- Parcours
  education_level text not null check (education_level in (
    'terminale', 'l1', 'l2', 'l3', 'm1', 'm2', 'bac_plus_2', 'doctorate', 'other'
  )),
  current_field text check (public.is_clean_text(current_field, 150)),
  current_institution text check (public.is_clean_text(current_institution, 150)),
  diplomas jsonb not null default '[]'
    check (public.is_json_object_list(diplomas, 10)),
  language_tests jsonb not null default '[]'
    check (public.is_json_object_list(language_tests, 10)),

  -- Projet (texte libre sur plusieurs lignes)
  study_project text check (study_project ~ '\S' and length(study_project) <= 2000),
  career_project text check (career_project ~ '\S' and length(career_project) <= 2000),

  status text not null default 'active'
    check (status in ('active', 'closed', 'abandoned')),
  -- Dossiers de documents de départ déjà créés (voir documents)
  folders_initialized_at timestamptz,
  search_name text generated always as
    (public.normalize_name(last_name || ' ' || first_name)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Cibles des liens composites des autres tables
  constraint cases_id_agency_unique unique (id, agency_id),
  constraint cases_id_agency_campaign_unique unique (id, agency_id, campaign_id),

  -- Campagne, créateur et responsable sont de la même agence que le dossier.
  -- La campagne ne peut pas être supprimée tant qu'elle a des dossiers, et un
  -- employé qui a créé un dossier ne peut plus l'être (désactivation seulement).
  constraint cases_campaign_fk foreign key (campaign_id, agency_id)
    references public.campaigns (id, agency_id),
  constraint cases_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id),
  constraint cases_assigned_to_fk foreign key (assigned_to, agency_id)
    references public.profiles (id, agency_id) on delete set null (assigned_to),

  -- Contact secondaire (un parent, par exemple) : nom et téléphone, ou aucun
  constraint cases_secondary_contact_complete
    check ((secondary_contact_name is null) = (secondary_contact_phone is null))
);

comment on column public.cases.diplomas is
  'Liste de 10 au plus : [{ "type": "baccalaureate" | "license" | "master" | "doctorate" | "other", "title": texte (150) | null, "year": entier | null }]';
comment on column public.cases.language_tests is
  'Liste de 10 au plus : [{ "test": "tcf" | "delf" | "dalf" | "ielts" | "toefl" | "other", "other_name": texte (100), obligatoire si "other", sinon null, "result": texte (50) | null, "date": "AAAA-MM-JJ" | null }]';

-- Dossiers d'une campagne (arbre, tableau de bord, dossiers récents)
create index cases_agency_campaign_created_idx
  on public.cases (agency_id, campaign_id, created_at desc);
-- Doublons et import depuis une autre campagne : même date de naissance
-- dans une campagne donnée
create index cases_campaign_birth_date_idx
  on public.cases (campaign_id, birth_date);
-- Clés étrangères vers profiles (contrôle à la suppression d'un profil) et
-- filtre « mes dossiers »
create index cases_created_by_idx on public.cases (created_by);
create index cases_assigned_to_idx on public.cases (assigned_to);

-- Pas de nouveau dossier dans une campagne archivée ; colonnes non
-- modifiables ; date de modification automatique.
create function public.cases_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.assert_campaign_active(new.campaign_id);
    return new;
  end if;

  if new.id is distinct from old.id
     or new.agency_id is distinct from old.agency_id
     or new.campaign_id is distinct from old.campaign_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'agency_id, campaign_id, created_by et created_at ne sont pas modifiables'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger cases_before_write
  before insert or update on public.cases
  for each row execute function public.cases_before_write();

-- Classement dans les groupes -----------------------------------------------

create table public.case_groups (
  case_id uuid not null,
  group_id uuid not null,
  agency_id uuid not null,
  campaign_id uuid not null,
  created_at timestamptz not null default now(),

  primary key (case_id, group_id),
  -- Dossier et groupe sont de la même agence ET de la même campagne.
  -- Supprimer un groupe retire seulement le classement, jamais le dossier.
  constraint case_groups_case_fk foreign key (case_id, agency_id, campaign_id)
    references public.cases (id, agency_id, campaign_id),
  constraint case_groups_group_fk foreign key (group_id, agency_id, campaign_id)
    references public.campaign_groups (id, agency_id, campaign_id) on delete cascade
);

-- Classement de toute une campagne (arbre)
create index case_groups_campaign_idx on public.case_groups (agency_id, campaign_id);
-- Suppression d'un groupe (cascade) et nombre de dossiers par groupe
create index case_groups_group_idx on public.case_groups (group_id);

-- Comptes externes ----------------------------------------------------------

create table public.case_external_accounts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  case_id uuid not null,
  platform text not null check (public.is_clean_text(platform, 80)),
  url text check (public.is_clean_text(url, 500) and url ~* '^https?://\S+$'),
  login text check (public.is_clean_text(login, 254)),
  -- existing : le candidat a déjà un compte ; to_create : compte à créer
  status text not null check (status in ('existing', 'to_create')),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint case_external_accounts_id_agency_unique unique (id, agency_id),
  constraint case_external_accounts_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_external_accounts_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id),
  constraint case_external_accounts_updated_by_fk foreign key (updated_by, agency_id)
    references public.profiles (id, agency_id),
  -- Compte existant : identifiant obligatoire (le mot de passe aussi, voir
  -- external_account_secrets)
  constraint case_external_accounts_login_if_existing
    check (status <> 'existing' or login is not null)
);

-- Un compte par plateforme et par dossier, majuscules ignorées (sert aussi à
-- lire les comptes d'un dossier)
create unique index case_external_accounts_platform_unique
  on public.case_external_accounts (case_id, lower(platform));
create index case_external_accounts_created_by_idx
  on public.case_external_accounts (created_by);
create index case_external_accounts_updated_by_idx
  on public.case_external_accounts (updated_by);

-- Colonnes non modifiables, date de modification
create function public.case_external_accounts_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.agency_id is distinct from old.agency_id
     or new.case_id is distinct from old.case_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Ces colonnes du compte externe ne sont pas modifiables'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger case_external_accounts_before_update
  before update on public.case_external_accounts
  for each row execute function public.case_external_accounts_before_update();

-- Mot de passe CHIFFRÉ par le serveur (AES-256-GCM, lié au compte).
-- Aucun droit côté client, même en lecture.
create table public.external_account_secrets (
  account_id uuid primary key,
  agency_id uuid not null,
  password_encrypted text not null check (length(password_encrypted) > 0),
  key_version smallint not null default 1 check (key_version > 0),
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint external_account_secrets_account_fk foreign key (account_id, agency_id)
    references public.case_external_accounts (id, agency_id) on delete cascade,
  constraint external_account_secrets_updated_by_fk foreign key (updated_by, agency_id)
    references public.profiles (id, agency_id)
);

create index external_account_secrets_updated_by_idx
  on public.external_account_secrets (updated_by);

-- Invariant vérifié en fin de transaction (le compte et son secret sont
-- écrits l'un après l'autre) : un compte « existing » a un mot de passe,
-- un compte « to_create » n'en a pas.
create function public.check_external_account_secret(p_account_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_has_secret boolean;
begin
  select status into v_status
  from public.case_external_accounts where id = p_account_id;
  if not found then
    return;
  end if;

  v_has_secret := exists (
    select 1 from public.external_account_secrets where account_id = p_account_id
  );
  if v_status = 'existing' and not v_has_secret then
    raise exception 'Mot de passe requis pour un compte existant'
      using errcode = '23514';
  end if;
  if v_status = 'to_create' and v_has_secret then
    raise exception 'Un compte à créer n''a pas de mot de passe'
      using errcode = '23514';
  end if;
end;
$$;

create function public.case_external_accounts_after_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform public.check_external_account_secret(new.id);
  return null;
end;
$$;

create constraint trigger case_external_accounts_secret_check
  after insert or update on public.case_external_accounts
  deferrable initially deferred
  for each row execute function public.case_external_accounts_after_write();

create function public.external_account_secrets_after_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.check_external_account_secret(old.account_id);
  else
    perform public.check_external_account_secret(new.account_id);
  end if;
  return null;
end;
$$;

create constraint trigger external_account_secrets_check
  after insert or delete on public.external_account_secrets
  deferrable initially deferred
  for each row execute function public.external_account_secrets_after_write();

alter table public.cases enable row level security;
alter table public.case_groups enable row level security;
alter table public.case_external_accounts enable row level security;
alter table public.external_account_secrets enable row level security;

-- Fonctions d'écriture (serveur seulement) ----------------------------------

-- Champs du dossier modifiables par création et modification. Toute autre
-- clé est refusée : campagne, auteur, responsable, statut ont leur fonction.
create function public.assert_case_fields(p_fields jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_fields) is distinct from 'object' or exists (
    select 1 from jsonb_object_keys(p_fields) as k
    where k <> all (array[
      'first_name', 'last_name', 'birth_date', 'phone', 'email', 'city',
      'nationality', 'secondary_contact_name', 'secondary_contact_phone',
      'education_level', 'current_field', 'current_institution', 'diplomas',
      'language_tests', 'study_project', 'career_project'
    ])
  ) then
    raise exception 'Champs du dossier invalides' using errcode = '22023';
  end if;
end;
$$;

-- Crée ou modifie un compte externe d'un dossier (tout membre actif).
-- - p_account_id est choisi par le serveur : le mot de passe est chiffré
--   AVANT l'appel, lié à ce compte précis.
-- - Compte « existing » : mot de passe obligatoire à la création ; ensuite,
--   absent = l'ancien est conservé.
-- - Un compte « existing » ne redevient pas « to_create ».
-- Renvoie vrai si le compte vient d'être créé.
create function public.save_external_account(
  p_account_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_platform text,
  p_url text,
  p_login text,
  p_status text,
  p_password_encrypted text,
  p_key_version smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_status text;
  v_created boolean;
  v_has_password boolean := coalesce(p_password_encrypted, '') <> '';
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  -- Verrouille le dossier (de la bonne agence) : deux ajouts simultanés ne
  -- dépassent pas la limite.
  perform 1 from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  if p_status = 'to_create' and v_has_password then
    raise exception 'Un compte à créer n''a pas de mot de passe'
      using errcode = '22023';
  end if;

  select status into v_old_status
  from public.case_external_accounts
  where id = p_account_id and case_id = p_case_id and agency_id = p_agency_id
  for update;
  v_created := not found;

  if v_created then
    if (select count(*) from public.case_external_accounts
        where case_id = p_case_id) >= 10 then
      raise exception 'Limite de 10 comptes par dossier atteinte'
        using errcode = '54000';
    end if;

    insert into public.case_external_accounts (
      id, agency_id, case_id, platform, url, login, status, created_by, updated_by
    ) values (
      p_account_id, p_agency_id, p_case_id, p_platform, p_url, p_login,
      p_status, p_actor_id, p_actor_id
    );
  else
    if v_old_status = 'existing' and p_status = 'to_create' then
      raise exception 'Un compte existant ne redevient pas « à créer »'
        using errcode = '22023';
    end if;

    update public.case_external_accounts
    set platform = p_platform,
        url = p_url,
        login = p_login,
        status = p_status,
        updated_by = p_actor_id
    where id = p_account_id;
  end if;

  if v_has_password then
    insert into public.external_account_secrets (
      account_id, agency_id, password_encrypted, key_version, updated_by
    ) values (
      p_account_id, p_agency_id, p_password_encrypted, p_key_version, p_actor_id
    )
    on conflict (account_id) do update
      set password_encrypted = excluded.password_encrypted,
          key_version = excluded.key_version,
          updated_by = excluded.updated_by,
          updated_at = now();
  end if;

  -- Vérifie dès maintenant l'invariant mot de passe / statut (contrôle
  -- différé), puis le remet en différé pour les écritures suivantes.
  set constraints public.case_external_accounts_secret_check,
    public.external_account_secrets_check immediate;
  set constraints public.case_external_accounts_secret_check,
    public.external_account_secrets_check deferred;

  return v_created;
end;
$$;

-- Crée un dossier complet en UNE transaction : dossier, classement,
-- comptes externes (+ mots de passe chiffrés) et note initiale. Si une
-- seule étape échoue, rien n'est créé.
-- - p_fields : champs de assert_case_fields (diplomas/language_tests en JSON)
-- - p_group_ids : groupes de la campagne du dossier
-- - p_accounts : [{ "id", "platform", "url", "login", "status",
--   "password_encrypted", "key_version" }], 10 au plus
-- Un employé est toujours responsable des dossiers qu'il crée ; seul le
-- patron peut en désigner un autre.
create function public.create_case(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_campaign_id uuid,
  p_assigned_to uuid,
  p_fields jsonb,
  p_group_ids uuid[],
  p_accounts jsonb,
  p_initial_note text
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

  v_case := jsonb_populate_record(null::public.cases, p_fields);

  insert into public.cases (
    id, agency_id, campaign_id, created_by, assigned_to,
    first_name, last_name, birth_date, phone, email, city, nationality,
    secondary_contact_name, secondary_contact_phone,
    education_level, current_field, current_institution, diplomas, language_tests,
    study_project, career_project
  ) values (
    p_case_id, p_agency_id, p_campaign_id, p_actor_id, p_assigned_to,
    v_case.first_name, v_case.last_name, v_case.birth_date, v_case.phone,
    v_case.email, v_case.city, v_case.nationality,
    v_case.secondary_contact_name, v_case.secondary_contact_phone,
    v_case.education_level, v_case.current_field, v_case.current_institution,
    coalesce(v_case.diplomas, '[]'), coalesce(v_case.language_tests, '[]'),
    v_case.study_project, v_case.career_project
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

  return p_case_id;
end;
$$;

-- Modifie les champs du dossier présents dans p_fields (tout membre actif).
-- Campagne, responsable, statut et classement ont leur propre fonction.
create function public.update_case(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_fields jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.cases;
  v_new public.cases;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);
  perform public.assert_case_fields(p_fields);

  select * into v_old
  from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  -- Les clés absentes de p_fields gardent leur valeur actuelle
  v_new := jsonb_populate_record(v_old, p_fields);

  update public.cases
  set first_name = v_new.first_name,
      last_name = v_new.last_name,
      birth_date = v_new.birth_date,
      phone = v_new.phone,
      email = v_new.email,
      city = v_new.city,
      nationality = v_new.nationality,
      secondary_contact_name = v_new.secondary_contact_name,
      secondary_contact_phone = v_new.secondary_contact_phone,
      education_level = v_new.education_level,
      current_field = v_new.current_field,
      current_institution = v_new.current_institution,
      diplomas = v_new.diplomas,
      language_tests = v_new.language_tests,
      study_project = v_new.study_project,
      career_project = v_new.career_project
  where id = p_case_id and agency_id = p_agency_id;
end;
$$;

-- Change le responsable d'un dossier : patron seulement.
create function public.set_case_assignee(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_assigned_to uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  if not exists (
    select 1 from public.profiles
    where id = p_assigned_to and agency_id = p_agency_id and is_active
  ) then
    raise exception 'Responsable invalide' using errcode = '22023';
  end if;

  update public.cases
  set assigned_to = p_assigned_to
  where id = p_case_id and agency_id = p_agency_id;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Change le statut d'un dossier (tout membre actif). Renvoie l'ancien statut.
create function public.set_case_status(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  select status into v_old
  from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  update public.cases
  set status = p_status
  where id = p_case_id and agency_id = p_agency_id and status <> p_status;

  return v_old;
end;
$$;

-- Remplace le classement d'un dossier dans les groupes de sa campagne
-- (tout membre actif, même si la campagne est archivée).
create function public.set_case_groups(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_group_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign_id uuid;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  select campaign_id into v_campaign_id
  from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  delete from public.case_groups
  where case_id = p_case_id
    and group_id <> all (coalesce(p_group_ids, '{}'));

  insert into public.case_groups (case_id, group_id, agency_id, campaign_id)
  select distinct p_case_id, g, p_agency_id, v_campaign_id
  from unnest(coalesce(p_group_ids, '{}')) as g
  on conflict (case_id, group_id) do nothing;
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on all functions in schema public from public;

grant execute on function public.normalize_name(text) to service_role;
grant execute on function public.is_json_object_list(jsonb, integer) to service_role;
grant execute on function public.save_external_account(
  uuid, uuid, uuid, uuid, text, text, text, text, text, smallint
) to service_role;
grant execute on function public.create_case(
  uuid, uuid, uuid, uuid, uuid, jsonb, uuid[], jsonb, text
) to service_role;
grant execute on function public.update_case(uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.set_case_assignee(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.set_case_status(uuid, uuid, uuid, text) to service_role;
grant execute on function public.set_case_groups(uuid, uuid, uuid, uuid[]) to service_role;

-- Lecture seule : aucun secret dans ces tables
grant select on public.cases, public.case_groups, public.case_external_accounts
  to authenticated, service_role;
-- Mots de passe chiffrés : le serveur seul les lit (affichage journalisé)
grant select on public.external_account_secrets to service_role;

create policy "cases_select_same_agency" on public.cases
  for select to authenticated
  using (agency_id = public.current_agency_id());

create policy "case_groups_select_same_agency" on public.case_groups
  for select to authenticated
  using (agency_id = public.current_agency_id());

create policy "case_external_accounts_select_same_agency" on public.case_external_accounts
  for select to authenticated
  using (agency_id = public.current_agency_id());
