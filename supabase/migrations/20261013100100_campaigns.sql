-- Migration : campaigns
-- Campagnes de chaque agence (plusieurs en parallèle), avec leurs dates,
-- leurs informations libres et leurs groupes (rangement des dossiers).
-- Lecture : membres actifs de l'agence (RLS).
-- Écriture : uniquement par les fonctions ci-dessous (routes serveur).
-- - campagne : patron seulement (création, import de modèle, modification,
--   archivage, réactivation, suppression si vide) ;
-- - groupes : tout membre actif.
-- Une campagne archivée est figée : ni réglages, ni dates, ni informations,
-- ni groupes ne changent, et elle ne reçoit plus de dossier (voir cases).

-- Plateformes suggérées : 10 au plus, chacune « propre » et de 80 caractères
-- au plus, sans doublon (majuscules ignorées).
create function public.is_valid_platform_list(p_platforms text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_platforms) <= 10
    and coalesce(
      (select bool_and(coalesce(public.is_clean_text(p, 80), false))
       from unnest(p_platforms) as p),
      true)
    and (select count(distinct lower(p)) from unnest(p_platforms) as p)
        = cardinality(p_platforms)
$$;

-- Tables --------------------------------------------------------------------

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  name text not null check (public.is_clean_text(name, 100)),
  status text not null default 'active' check (status in ('active', 'archived')),
  -- Modèle d'origine (configuration du code) ; la campagne en est une copie
  template_key text check (template_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  suggested_platforms text[] not null default '{}'
    check (public.is_valid_platform_list(suggested_platforms)),
  created_by uuid not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint campaigns_id_agency_unique unique (id, agency_id),
  constraint campaigns_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id),
  constraint campaigns_archived_consistent
    check ((status = 'archived') = (archived_at is not null))
);

-- Un nom par agence et un import par modèle, majuscules ignorées
create unique index campaigns_name_unique
  on public.campaigns (agency_id, lower(name));
create unique index campaigns_template_unique
  on public.campaigns (agency_id, template_key)
  where template_key is not null;

create table public.campaign_dates (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  campaign_id uuid not null,
  label text not null check (public.is_clean_text(label, 100)),
  date date not null check (date between date '2000-01-01' and date '2100-12-31'),
  created_at timestamptz not null default now(),

  constraint campaign_dates_campaign_fk foreign key (campaign_id, agency_id)
    references public.campaigns (id, agency_id) on delete cascade
);

-- Lecture des dates d'une campagne (fiche, arbre, tableau de bord)
create index campaign_dates_campaign_idx
  on public.campaign_dates (campaign_id, date);

create table public.campaign_infos (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  campaign_id uuid not null,
  label text not null check (public.is_clean_text(label, 100)),
  value text not null check (public.is_clean_text(value, 500)),
  position smallint not null check (position >= 0),
  created_at timestamptz not null default now(),

  constraint campaign_infos_campaign_fk foreign key (campaign_id, agency_id)
    references public.campaigns (id, agency_id) on delete cascade,
  constraint campaign_infos_position_unique unique (campaign_id, position)
);

create table public.campaign_groups (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  campaign_id uuid not null,
  name text not null check (public.is_clean_text(name, 80)),
  position integer not null default 0 check (position >= 0),
  -- Devient vide si l'employé est supprimé : un groupe est du rangement,
  -- pas de l'historique (même règle que les dossiers de documents).
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint campaign_groups_campaign_fk foreign key (campaign_id, agency_id)
    references public.campaigns (id, agency_id) on delete cascade,
  constraint campaign_groups_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id) on delete set null (created_by),
  -- Cible du lien composite depuis case_groups : un dossier n'est classé que
  -- dans un groupe de SA campagne et de SON agence.
  constraint campaign_groups_id_agency_campaign_unique
    unique (id, agency_id, campaign_id)
);

-- Un nom par campagne, majuscules ignorées (sert aussi à lire les groupes
-- d'une campagne)
create unique index campaign_groups_name_unique
  on public.campaign_groups (campaign_id, lower(name));
create index campaign_groups_created_by_idx
  on public.campaign_groups (created_by);

-- Campagne archivée ---------------------------------------------------------

-- Refuse si la campagne est archivée. Une campagne introuvable passe : c'est
-- le cas pendant sa suppression, quand ses lignes liées partent en cascade.
create function public.assert_campaign_active(p_campaign_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.campaigns
    where id = p_campaign_id and status = 'archived'
  ) then
    raise exception 'Campagne archivée : réactivez-la d''abord'
      using errcode = '55000';
  end if;
end;
$$;

-- Colonnes non modifiables, réglages figés une fois archivée, date
-- d'archivage tenue à jour par la base.
create function public.campaigns_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.agency_id is distinct from old.agency_id
     or new.template_key is distinct from old.template_key
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Ces colonnes de la campagne ne sont pas modifiables'
      using errcode = '42501';
  end if;

  if old.status = 'archived' and new.status = 'archived'
     and (new.name is distinct from old.name
          or new.suggested_platforms is distinct from old.suggested_platforms) then
    raise exception 'Campagne archivée : réactivez-la d''abord'
      using errcode = '55000';
  end if;

  if new.status is distinct from old.status then
    new.archived_at := case when new.status = 'archived' then now() end;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger campaigns_before_update
  before update on public.campaigns
  for each row execute function public.campaigns_before_update();

-- Dates et informations : rien ne change dans une campagne archivée
create function public.campaign_details_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.assert_campaign_active(old.campaign_id);
    return old;
  end if;
  if tg_op = 'UPDATE'
     and (new.agency_id is distinct from old.agency_id
          or new.campaign_id is distinct from old.campaign_id) then
    raise exception 'Une ligne ne change pas de campagne' using errcode = '42501';
  end if;
  perform public.assert_campaign_active(new.campaign_id);
  return new;
end;
$$;

create trigger campaign_dates_before_write
  before insert or update or delete on public.campaign_dates
  for each row execute function public.campaign_details_before_write();

create trigger campaign_infos_before_write
  before insert or update or delete on public.campaign_infos
  for each row execute function public.campaign_details_before_write();

-- Groupes : figés dans une campagne archivée (le classement des dossiers,
-- lui, reste modifiable). Seul created_by peut devenir vide à tout moment.
create function public.campaign_groups_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.assert_campaign_active(old.campaign_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.agency_id is distinct from old.agency_id
       or new.campaign_id is distinct from old.campaign_id
       or new.created_at is distinct from old.created_at
       or (new.created_by is distinct from old.created_by
           and new.created_by is not null) then
      raise exception 'Ces colonnes du groupe ne sont pas modifiables'
        using errcode = '42501';
    end if;
    if new.name is not distinct from old.name
       and new.position is not distinct from old.position then
      -- Seul created_by change (profil supprimé) : toujours permis
      return new;
    end if;
    new.updated_at := now();
  end if;

  perform public.assert_campaign_active(new.campaign_id);
  return new;
end;
$$;

create trigger campaign_groups_before_write
  before insert or update or delete on public.campaign_groups
  for each row execute function public.campaign_groups_before_write();

alter table public.campaigns enable row level security;
alter table public.campaign_dates enable row level security;
alter table public.campaign_infos enable row level security;
alter table public.campaign_groups enable row level security;

-- Fonctions d'écriture (serveur seulement) ----------------------------------

-- Remplace toutes les dates et informations d'une campagne.
-- p_dates : [{ "label": "…", "date": "AAAA-MM-JJ" }], 30 au plus
-- p_infos : [{ "label": "…", "value": "…" }], 30 au plus, dans l'ordre affiché
create function public.replace_campaign_details(
  p_campaign_id uuid,
  p_agency_id uuid,
  p_dates jsonb,
  p_infos jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if jsonb_typeof(p_dates) is distinct from 'array'
     or jsonb_array_length(p_dates) > 30
     or jsonb_typeof(p_infos) is distinct from 'array'
     or jsonb_array_length(p_infos) > 30 then
    raise exception 'Dates ou informations invalides' using errcode = '22023';
  end if;

  delete from public.campaign_dates where campaign_id = p_campaign_id;
  insert into public.campaign_dates (agency_id, campaign_id, label, date)
  select p_agency_id, p_campaign_id, d ->> 'label', (d ->> 'date')::date
  from jsonb_array_elements(p_dates) as d;

  delete from public.campaign_infos where campaign_id = p_campaign_id;
  insert into public.campaign_infos (agency_id, campaign_id, label, value, position)
  select p_agency_id, p_campaign_id, i.value ->> 'label', i.value ->> 'value',
    (i.ordinality - 1)::smallint
  from jsonb_array_elements(p_infos) with ordinality as i(value, ordinality);
end;
$$;

-- Crée une campagne avec ses dates, informations et groupes, en UNE
-- transaction. Sert aussi à l'import d'un modèle (p_template_key renseigné).
create function public.create_campaign(
  p_agency_id uuid,
  p_actor_id uuid,
  p_name text,
  p_template_key text,
  p_suggested_platforms text[],
  p_dates jsonb,
  p_infos jsonb,
  p_groups text[]
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
    agency_id, name, template_key, suggested_platforms, created_by
  ) values (
    p_agency_id, p_name, p_template_key, coalesce(p_suggested_platforms, '{}'),
    p_actor_id
  )
  returning id into v_id;

  perform public.replace_campaign_details(v_id, p_agency_id, p_dates, p_infos);

  insert into public.campaign_groups (agency_id, campaign_id, name, position, created_by)
  select p_agency_id, v_id, g.name, (g.ordinality - 1)::integer, p_actor_id
  from unnest(coalesce(p_groups, '{}')) with ordinality as g(name, ordinality);

  return v_id;
end;
$$;

-- Modifie le nom, les plateformes suggérées, les dates et les informations
-- d'une campagne active (patron seulement).
create function public.update_campaign(
  p_campaign_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_name text,
  p_suggested_platforms text[],
  p_dates jsonb,
  p_infos jsonb
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
      suggested_platforms = coalesce(p_suggested_platforms, '{}')
  where id = p_campaign_id and agency_id = p_agency_id;

  perform public.replace_campaign_details(p_campaign_id, p_agency_id, p_dates, p_infos);
end;
$$;

-- Archive ou réactive une campagne (patron seulement).
-- Renvoie vrai si le statut a changé.
create function public.set_campaign_status(
  p_campaign_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  if p_status is null or p_status not in ('active', 'archived') then
    raise exception 'Statut invalide' using errcode = '22023';
  end if;

  update public.campaigns
  set status = p_status
  where id = p_campaign_id and agency_id = p_agency_id and status <> p_status;
  if found then
    return true;
  end if;

  if not exists (
    select 1 from public.campaigns
    where id = p_campaign_id and agency_id = p_agency_id
  ) then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;
  return false;
end;
$$;

-- Supprime une campagne VIDE (patron seulement), avec ses dates,
-- informations et groupes. Une campagne qui a des dossiers s'archive.
create function public.delete_campaign(
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
  perform public.require_owner(p_actor_id, p_agency_id);

  begin
    delete from public.campaigns
    where id = p_campaign_id and agency_id = p_agency_id;
  exception when foreign_key_violation then
    -- Les dossiers référencent la campagne (voir cases) : la base refuse
    raise exception 'Cette campagne contient des dossiers : archivez-la'
      using errcode = '2BP01';
  end;

  if not found then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Groupes : tout membre actif ------------------------------------------------

create function public.create_campaign_group(
  p_campaign_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_count integer;
  v_position integer;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  -- Verrouille la campagne : deux créations simultanées n'obtiennent pas
  -- la même position ni ne dépassent la limite.
  perform 1 from public.campaigns
  where id = p_campaign_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;

  select count(*), coalesce(max(position) + 1, 0)
  into v_count, v_position
  from public.campaign_groups
  where campaign_id = p_campaign_id;

  if v_count >= 30 then
    raise exception 'Limite de 30 groupes par campagne atteinte'
      using errcode = '54000';
  end if;

  insert into public.campaign_groups (agency_id, campaign_id, name, position, created_by)
  values (p_agency_id, p_campaign_id, p_name, v_position, p_actor_id)
  returning id into v_id;

  return v_id;
end;
$$;

create function public.rename_campaign_group(
  p_group_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  update public.campaign_groups
  set name = p_name
  where id = p_group_id and agency_id = p_agency_id;

  if not found then
    raise exception 'Groupe introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Supprimer un groupe ne retire que le classement : les dossiers restent
-- (case_groups part en cascade, voir cases).
create function public.delete_campaign_group(
  p_group_id uuid,
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

  delete from public.campaign_groups
  where id = p_group_id and agency_id = p_agency_id;

  if not found then
    raise exception 'Groupe introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on all functions in schema public from public;

grant execute on function public.is_valid_platform_list(text[]) to service_role;
grant execute on function public.create_campaign(uuid, uuid, text, text, text[], jsonb, jsonb, text[])
  to service_role;
grant execute on function public.update_campaign(uuid, uuid, uuid, text, text[], jsonb, jsonb)
  to service_role;
grant execute on function public.set_campaign_status(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.delete_campaign(uuid, uuid, uuid) to service_role;
grant execute on function public.create_campaign_group(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.rename_campaign_group(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.delete_campaign_group(uuid, uuid, uuid)
  to service_role;

-- Lecture seule, pour le navigateur (RLS) comme pour le serveur
grant select on public.campaigns, public.campaign_dates, public.campaign_infos,
  public.campaign_groups to authenticated, service_role;

create policy "campaigns_select_same_agency" on public.campaigns
  for select to authenticated
  using (agency_id = public.current_agency_id());

create policy "campaign_dates_select_same_agency" on public.campaign_dates
  for select to authenticated
  using (agency_id = public.current_agency_id());

create policy "campaign_infos_select_same_agency" on public.campaign_infos
  for select to authenticated
  using (agency_id = public.current_agency_id());

create policy "campaign_groups_select_same_agency" on public.campaign_groups
  for select to authenticated
  using (agency_id = public.current_agency_id());
