-- Migration : campaigns_per_agency
-- Remplace les campagnes GLOBALES (une seule « en cours », dates fixes de
-- Campus France) par des campagnes qui APPARTIENNENT À UNE AGENCE :
--   * l'agence crée ses campagnes (nom libre, dates libres, plateforme de
--     candidature facultative) ou en importe depuis un modèle ;
--   * un modèle est une campagne préconfigurée, ajoutée par migration par
--     l'administrateur de la plateforme (une ligne par année et par pays) ;
--   * importer un modèle COPIE la campagne, ses dates et ses dossiers de
--     rangement : la copie est ensuite indépendante du modèle ;
--   * les dossiers de rangement (DAP, Hors-DAP, École...) sont des objets
--     que l'agence renomme, supprime ou crée.
-- Lecture : utilisateurs actifs de l'agence (RLS).
-- Écriture : routes serveur uniquement, réservée au patron.
-- Un dossier candidat appartient à UNE campagne de SA agence (lien composite) :
-- le même candidat dans deux campagnes = deux dossiers totalement séparés.

-- Garde-fou : cette migration supprime les anciennes campagnes. Elle refuse de
-- s'appliquer s'il existe des dossiers (données de test à effacer d'abord :
-- `npx supabase db reset` en local, `db reset --linked` pour la base en ligne).
do $$
begin
  if exists (select 1 from public.cases) then
    raise exception
      'Des dossiers existent : réinitialisez la base de test avant cette migration'
      using errcode = 'P0001';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Modèles de campagne (table globale, lecture seule, ajout par migration)
-- ---------------------------------------------------------------------------

create table public.campaign_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (name = btrim(name) and length(name) between 1 and 100),
  description text check (description is null or length(description) <= 1000),
  -- Plateforme de candidature (Pastel, Universitaly...). Vide : aucune.
  platform_name text check (
    platform_name is null
    or (platform_name = btrim(platform_name) and length(platform_name) between 1 and 60)
  ),
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.campaign_template_deadlines (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.campaign_templates (id) on delete cascade,
  label text not null check (label = btrim(label) and length(label) between 1 and 100),
  due_on date not null,
  note text check (note is null or length(note) <= 500),
  position integer not null default 0 check (position >= 0)
);

create index campaign_template_deadlines_idx
  on public.campaign_template_deadlines (template_id, position);

create table public.campaign_template_folders (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.campaign_templates (id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 80),
  position integer not null default 0 check (position >= 0)
);

create unique index campaign_template_folders_name_unique
  on public.campaign_template_folders (template_id, lower(name));

alter table public.campaign_templates enable row level security;
alter table public.campaign_template_deadlines enable row level security;
alter table public.campaign_template_folders enable row level security;

revoke all on public.campaign_templates from anon, authenticated;
revoke all on public.campaign_template_deadlines from anon, authenticated;
revoke all on public.campaign_template_folders from anon, authenticated;

-- Lecture seule : aucune écriture côté client ni côté serveur applicatif.
-- Les modèles s'ajoutent par migration.
grant select on public.campaign_templates to authenticated, service_role;
grant select on public.campaign_template_deadlines to authenticated, service_role;
grant select on public.campaign_template_folders to authenticated, service_role;

create policy "campaign_templates_select_published" on public.campaign_templates
  for select to authenticated
  using (is_published and public.current_agency_id() is not null);

create policy "campaign_template_deadlines_select_published"
  on public.campaign_template_deadlines
  for select to authenticated
  using (
    public.current_agency_id() is not null
    and exists (
      select 1 from public.campaign_templates t
      where t.id = template_id and t.is_published
    )
  );

create policy "campaign_template_folders_select_published"
  on public.campaign_template_folders
  for select to authenticated
  using (
    public.current_agency_id() is not null
    and exists (
      select 1 from public.campaign_templates t
      where t.id = template_id and t.is_published
    )
  );

-- ---------------------------------------------------------------------------
-- Campagnes d'agence (remplacent l'ancienne table globale)
-- ---------------------------------------------------------------------------

-- Supprime l'ancienne table et, avec elle, la clé étrangère de `cases`
-- (recréée plus bas, en version composite avec l'agence).
drop table public.campaigns cascade;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,

  name text not null check (name = btrim(name) and length(name) between 1 and 100),
  description text check (description is null or length(description) <= 1000),
  -- Plateforme de candidature de cette campagne (Pastel...). Vide : aucune,
  -- et la section « compte plateforme » n'apparaît pas dans le dossier.
  platform_name text check (
    platform_name is null
    or (platform_name = btrim(platform_name) and length(platform_name) between 1 and 60)
  ),

  status text not null default 'active' check (status in ('active', 'archived')),
  archived_at timestamptz,

  -- Modèle d'origine, pour information. La copie reste indépendante.
  template_id uuid references public.campaign_templates (id) on delete set null,

  -- Auteur : devient vide si le profil est supprimé (une campagne n'est pas
  -- de l'historique sensible).
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint campaigns_archived_consistent
    check ((status = 'archived') = (archived_at is not null)),
  constraint campaigns_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id) on delete set null (created_by),

  -- Nécessaire aux liens composites (dossiers, dates, dossiers de rangement)
  constraint campaigns_id_agency_unique unique (id, agency_id)
);

-- Un nom par agence, sans tenir compte des majuscules
create unique index campaigns_name_unique on public.campaigns (agency_id, lower(name));
create index campaigns_agency_status_idx on public.campaigns (agency_id, status);
create index campaigns_created_by_idx on public.campaigns (created_by);

-- Dates limites et informations datées d'une campagne (liste libre)
create table public.campaign_deadlines (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  campaign_id uuid not null,

  label text not null check (label = btrim(label) and length(label) between 1 and 100),
  due_on date not null,
  note text check (note is null or length(note) <= 500),
  position integer not null default 0 check (position >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint campaign_deadlines_campaign_fk foreign key (campaign_id, agency_id)
    references public.campaigns (id, agency_id) on delete cascade
);

create index campaign_deadlines_idx
  on public.campaign_deadlines (agency_id, campaign_id, due_on, position);

-- Dossiers de rangement d'une campagne (DAP, Hors-DAP, École, ou autres)
create table public.campaign_folders (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  campaign_id uuid not null,

  name text not null check (name = btrim(name) and length(name) between 1 and 80),
  position integer not null default 0 check (position >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint campaign_folders_campaign_fk foreign key (campaign_id, agency_id)
    references public.campaigns (id, agency_id) on delete cascade,

  -- Nécessaire au lien composite depuis les dossiers candidats (bloc suivant)
  constraint campaign_folders_id_campaign_agency_unique
    unique (id, campaign_id, agency_id)
);

create unique index campaign_folders_name_unique
  on public.campaign_folders (campaign_id, lower(name));
create index campaign_folders_idx
  on public.campaign_folders (agency_id, campaign_id, position);

-- Colonnes non modifiables, date de modification automatique ------------------

create or replace function public.campaigns_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- created_by et template_id peuvent seulement devenir vides (suppression
  -- du profil ou du modèle par une clé étrangère `set null`).
  if new.id is distinct from old.id
     or new.agency_id is distinct from old.agency_id
     or new.created_at is distinct from old.created_at
     or (new.created_by is distinct from old.created_by and new.created_by is not null)
     or (new.template_id is distinct from old.template_id and new.template_id is not null) then
    raise exception 'Ces colonnes de la campagne ne sont pas modifiables'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger campaigns_before_update
  before update on public.campaigns
  for each row execute function public.campaigns_before_update();

create or replace function public.campaign_children_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.agency_id is distinct from old.agency_id
     or new.campaign_id is distinct from old.campaign_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Ces colonnes ne sont pas modifiables'
      using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger campaign_deadlines_before_update
  before update on public.campaign_deadlines
  for each row execute function public.campaign_children_before_update();

create trigger campaign_folders_before_update
  before update on public.campaign_folders
  for each row execute function public.campaign_children_before_update();

-- Droits et RLS ---------------------------------------------------------------

alter table public.campaigns enable row level security;
alter table public.campaign_deadlines enable row level security;
alter table public.campaign_folders enable row level security;

revoke all on public.campaigns from anon, authenticated;
revoke all on public.campaign_deadlines from anon, authenticated;
revoke all on public.campaign_folders from anon, authenticated;

grant select on public.campaigns to authenticated;
grant select on public.campaign_deadlines to authenticated;
grant select on public.campaign_folders to authenticated;

-- Routes serveur (patron seul, vérifié par la route). Pas de delete direct sur
-- les campagnes ni sur les dossiers de rangement : voir delete_campaign et
-- delete_campaign_folder, qui contrôlent le patron dans la base elle-même.
grant select, insert, update on public.campaigns to service_role;
grant select, insert, update, delete on public.campaign_deadlines to service_role;
grant select, insert, update on public.campaign_folders to service_role;

create policy "campaigns_select_same_agency" on public.campaigns
  for select to authenticated
  using (agency_id = public.current_agency_id());

create policy "campaign_deadlines_select_same_agency" on public.campaign_deadlines
  for select to authenticated
  using (agency_id = public.current_agency_id());

create policy "campaign_folders_select_same_agency" on public.campaign_folders
  for select to authenticated
  using (agency_id = public.current_agency_id());

-- ---------------------------------------------------------------------------
-- Fonctions (serveur uniquement, patron actif de l'agence vérifié ici)
-- ---------------------------------------------------------------------------

-- Créer une campagne libre avec ses dates, dans UNE transaction.
-- p_deadlines : tableau JSON d'objets {"label": "...", "due_on": "2027-01-31", "note": "..."}
create or replace function public.create_campaign(
  p_agency_id uuid,
  p_actor_id uuid,
  p_name text,
  p_description text,
  p_platform_name text,
  p_deadlines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and agency_id = p_agency_id
      and role = 'owner' and is_active
  ) then
    raise exception 'Seul un patron actif peut créer une campagne'
      using errcode = '42501';
  end if;

  if p_deadlines is not null and jsonb_typeof(p_deadlines) <> 'array' then
    raise exception 'Dates limites invalides' using errcode = '22023';
  end if;

  insert into public.campaigns (agency_id, name, description, platform_name, created_by)
  values (p_agency_id, p_name, p_description, p_platform_name, p_actor_id)
  returning id into v_id;

  insert into public.campaign_deadlines (agency_id, campaign_id, label, due_on, note, position)
  select p_agency_id, v_id,
         d.e ->> 'label',
         (d.e ->> 'due_on')::date,
         nullif(d.e ->> 'note', ''),
         (d.n - 1)::integer
  from jsonb_array_elements(coalesce(p_deadlines, '[]'::jsonb))
       with ordinality as d(e, n);

  return v_id;
end;
$$;

-- Importer un modèle : copie la campagne, ses dates et ses dossiers de
-- rangement. La copie est indépendante du modèle.
create or replace function public.import_campaign_template(
  p_agency_id uuid,
  p_actor_id uuid,
  p_template_id uuid,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_template public.campaign_templates%rowtype;
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and agency_id = p_agency_id
      and role = 'owner' and is_active
  ) then
    raise exception 'Seul un patron actif peut importer une campagne'
      using errcode = '42501';
  end if;

  select * into v_template
  from public.campaign_templates
  where id = p_template_id and is_published;
  if not found then
    raise exception 'Modèle introuvable' using errcode = 'P0002';
  end if;

  insert into public.campaigns (
    agency_id, name, description, platform_name, template_id, created_by
  ) values (
    p_agency_id,
    coalesce(nullif(btrim(p_name), ''), v_template.name),
    v_template.description,
    v_template.platform_name,
    v_template.id,
    p_actor_id
  )
  returning id into v_id;

  insert into public.campaign_deadlines (agency_id, campaign_id, label, due_on, note, position)
  select p_agency_id, v_id, label, due_on, note, position
  from public.campaign_template_deadlines
  where template_id = v_template.id;

  insert into public.campaign_folders (agency_id, campaign_id, name, position)
  select p_agency_id, v_id, name, position
  from public.campaign_template_folders
  where template_id = v_template.id;

  return v_id;
end;
$$;

-- Supprimer une campagne VIDE. Une campagne qui contient des dossiers
-- candidats est refusée par la base (clé étrangère, code 23503) : on l'archive.
create or replace function public.delete_campaign(
  p_campaign_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and agency_id = p_agency_id
      and role = 'owner' and is_active
  ) then
    raise exception 'Seul un patron actif peut supprimer une campagne'
      using errcode = '42501';
  end if;

  delete from public.campaigns
  where id = p_campaign_id and agency_id = p_agency_id;

  if not found then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Supprimer un dossier de rangement. Les dossiers candidats ne sont jamais
-- supprimés : seuls leurs liens avec ce dossier de rangement disparaissent.
create or replace function public.delete_campaign_folder(
  p_folder_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and agency_id = p_agency_id
      and role = 'owner' and is_active
  ) then
    raise exception 'Seul un patron actif peut supprimer un dossier de rangement'
      using errcode = '42501';
  end if;

  delete from public.campaign_folders
  where id = p_folder_id and agency_id = p_agency_id;

  if not found then
    raise exception 'Dossier de rangement introuvable' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.create_campaign(uuid, uuid, text, text, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.import_campaign_template(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.delete_campaign(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.delete_campaign_folder(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.create_campaign(uuid, uuid, text, text, text, jsonb)
  to service_role;
grant execute on function public.import_campaign_template(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.delete_campaign(uuid, uuid, uuid) to service_role;
grant execute on function public.delete_campaign_folder(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Dossiers candidats : la campagne appartient à la MÊME agence
-- ---------------------------------------------------------------------------

alter table public.cases
  add constraint cases_campaign_fk foreign key (campaign_id, agency_id)
  references public.campaigns (id, agency_id);

-- create_case reçoit maintenant la campagne choisie (plus de campagne « en cours »)
drop function public.create_case(
  uuid, uuid, uuid, uuid, text, text, date, text, text, text, text,
  boolean, text, text, text, text[], text[], text, smallint
);

create or replace function public.create_case(
  p_case_id uuid,
  p_agency_id uuid,
  p_campaign_id uuid,
  p_created_by uuid,
  p_assigned_to uuid,
  p_first_name text,
  p_last_name text,
  p_birth_date date,
  p_phone text,
  p_email text,
  p_education_level text,
  p_main_track text,
  p_schools boolean,
  p_scope text,
  p_pastel_account text,
  p_pastel_email text,
  p_language_tests text[],
  p_diplomas text[],
  p_password_encrypted text,
  p_key_version smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Le créateur doit être un utilisateur actif de cette agence
  if not exists (
    select 1 from public.profiles
    where id = p_created_by and agency_id = p_agency_id and is_active
  ) then
    raise exception 'Créateur invalide' using errcode = '42501';
  end if;

  -- La campagne doit appartenir à l'agence et ne pas être archivée
  if not exists (
    select 1 from public.campaigns
    where id = p_campaign_id and agency_id = p_agency_id and status = 'active'
  ) then
    raise exception 'Campagne introuvable ou archivée' using errcode = 'P0002';
  end if;

  -- Le responsable, s'il est indiqué, doit être actif et de la même agence
  if p_assigned_to is not null and not exists (
    select 1 from public.profiles
    where id = p_assigned_to and agency_id = p_agency_id and is_active
  ) then
    raise exception 'Responsable invalide' using errcode = '22023';
  end if;

  -- Compte Pastel existant : le mot de passe est obligatoire
  if p_pastel_account = 'existing'
     and coalesce(p_password_encrypted, '') = '' then
    raise exception 'Mot de passe Pastel requis' using errcode = '23514';
  end if;

  insert into public.cases (
    id, agency_id, campaign_id, created_by, assigned_to,
    first_name, last_name, birth_date, phone, email,
    education_level, main_track, schools, scope,
    pastel_account, pastel_email, language_tests, diplomas
  ) values (
    p_case_id, p_agency_id, p_campaign_id, p_created_by, p_assigned_to,
    p_first_name, p_last_name, p_birth_date, p_phone, p_email,
    p_education_level, p_main_track, p_schools, p_scope,
    p_pastel_account, p_pastel_email, p_language_tests, p_diplomas
  );

  if coalesce(p_password_encrypted, '') <> '' then
    insert into public.case_pastel_credentials (
      case_id, agency_id, password_encrypted, key_version, updated_by
    ) values (
      p_case_id, p_agency_id, p_password_encrypted, p_key_version, p_created_by
    );
  end if;

  return p_case_id;
end;
$$;

revoke all on function public.create_case(
  uuid, uuid, uuid, uuid, uuid, text, text, date, text, text, text, text,
  boolean, text, text, text, text[], text[], text, smallint
) from public, anon, authenticated;

grant execute on function public.create_case(
  uuid, uuid, uuid, uuid, uuid, text, text, date, text, text, text, text,
  boolean, text, text, text, text[], text[], text, smallint
) to service_role;

-- ---------------------------------------------------------------------------
-- Modèle Campus France 2026/2027 (Algérie)
-- Chaque année, l'administrateur ajoute le modèle suivant dans une nouvelle
-- migration (une ligne de modèle, ses dates, ses dossiers de rangement).
-- ---------------------------------------------------------------------------

with t as (
  insert into public.campaign_templates (slug, name, description, platform_name)
  values (
    'campus-france-2026-2027',
    'Campus France 2026/2027 (Algérie)',
    'Procédure Études en France : calendrier officiel de la campagne 2026/2027 pour l''Algérie.',
    'Pastel'
  )
  returning id
), d as (
  insert into public.campaign_template_deadlines (template_id, label, due_on, note, position)
  select t.id, v.label, v.due_on::date, v.note, v.pos
  from t, (values
    ('Ouverture de la campagne', '2026-10-01', null, 0),
    ('Date limite hors-DAP', '2026-11-30',
      'L2 à M2, écoles d''ingénieurs et de commerce', 1),
    ('Date limite DAP', '2026-12-15', 'L1 et écoles d''architecture', 2),
    ('Date limite licences pro et BUT', '2026-12-15', null, 3),
    ('Fin des entretiens', '2027-03-15', null, 4),
    ('Réponses des établissements', '2027-04-30', null, 5),
    ('Choix définitif', '2027-05-31', null, 6)
  ) as v(label, due_on, note, pos)
), f as (
  insert into public.campaign_template_folders (template_id, name, position)
  select t.id, v.name, v.pos
  from t, (values ('DAP', 0), ('Hors-DAP', 1), ('École', 2)) as v(name, pos)
)
select 1;