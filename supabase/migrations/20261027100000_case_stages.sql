-- Migration : case_stages
-- Étapes des dossiers : chaque campagne a sa liste ordonnée d'étapes
-- (« Constitution du dossier », « Entretien », « Demande de visa »…) et
-- chaque dossier en occupe une. L'étape dit où en est le dossier ; le statut
-- (actif, clos, abandonné) reste à part.
-- Lecture : membres actifs de l'agence (RLS).
-- Écriture : uniquement par les fonctions ci-dessous (routes serveur).
-- - liste des étapes : patron seulement, figée dans une campagne archivée ;
-- - étape d'un dossier : tout membre actif (même campagne archivée, comme
--   le classement dans les groupes).

-- Table ----------------------------------------------------------------------

create table public.campaign_stages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null,
  campaign_id uuid not null,
  name text not null check (public.is_clean_text(name, 60)),
  position smallint not null check (position >= 0),
  created_at timestamptz not null default now(),

  constraint campaign_stages_campaign_fk foreign key (campaign_id, agency_id)
    references public.campaigns (id, agency_id) on delete cascade,
  -- Différée : une réorganisation échange des positions dans la même
  -- transaction
  constraint campaign_stages_position_unique unique (campaign_id, position)
    deferrable initially deferred,
  -- Cible du lien composite depuis cases : un dossier n'occupe qu'une étape
  -- de SA campagne et de SON agence
  constraint campaign_stages_id_agency_campaign_unique
    unique (id, agency_id, campaign_id)
);

-- Rien ne change dans une campagne archivée (même règle que les dates et
-- les informations)
create trigger campaign_stages_before_write
  before insert or update or delete on public.campaign_stages
  for each row execute function public.campaign_details_before_write();

alter table public.campaign_stages enable row level security;

-- Étape de chaque dossier -----------------------------------------------------

alter table public.cases
  add column stage_id uuid,
  add constraint cases_stage_fk foreign key (stage_id, agency_id, campaign_id)
    references public.campaign_stages (id, agency_id, campaign_id)
    on delete set null (stage_id);

-- Clé étrangère (suppression d'une étape) et compteurs par étape
create index cases_stage_idx on public.cases (stage_id);

-- Un nouveau dossier commence à la première étape de sa campagne (aucune si
-- la campagne n'a pas d'étape)
create function public.cases_default_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.stage_id is null then
    select id into new.stage_id
    from public.campaign_stages
    where campaign_id = new.campaign_id
    order by position
    limit 1;
  end if;
  return new;
end;
$$;

create trigger cases_default_stage
  before insert on public.cases
  for each row execute function public.cases_default_stage();

-- Compteurs : dossiers par campagne, étape et statut (campagne, tableau de
-- bord). security_invoker : lecture à travers le RLS.
create view public.case_stage_stats
with (security_invoker = true)
as
select campaign_id, stage_id, status, count(*)::integer as cases
from public.cases
group by campaign_id, stage_id, status;

-- Fonctions d'écriture (serveur seulement) -----------------------------------

-- Remplace la liste des étapes d'une campagne active (patron seulement).
-- p_stages : [{ "id": uuid | null, "name": "…" }], dans l'ordre, 15 au plus.
-- Une étape gardée garde son identifiant (ses dossiers la suivent) ; une
-- étape nouvelle n'en a pas. Les dossiers d'une étape retirée passent à
-- l'étape gardée qui la précédait (sinon à la première), et les dossiers
-- sans étape passent à la première. Renvoie le nombre de dossiers déplacés.
create function public.replace_campaign_stages(
  p_campaign_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_stages jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid[];
  v_ids uuid[] := '{}';
  v_item record;
  v_id uuid;
  v_target uuid;
  v_moved integer := 0;
  v_count integer;
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  if jsonb_typeof(p_stages) is distinct from 'array'
     or jsonb_array_length(p_stages) > 15
     or (select count(distinct lower(btrim(s ->> 'name')))
         from jsonb_array_elements(p_stages) as s) <> jsonb_array_length(p_stages) then
    raise exception 'Étapes invalides' using errcode = '22023';
  end if;

  perform 1 from public.campaigns
  where id = p_campaign_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;
  perform public.assert_campaign_active(p_campaign_id);

  v_old := array(
    select id from public.campaign_stages
    where campaign_id = p_campaign_id
    order by position
  );

  for v_item in
    select value, ordinality from jsonb_array_elements(p_stages) with ordinality
  loop
    v_id := nullif(v_item.value ->> 'id', '')::uuid;
    if v_id is null then
      insert into public.campaign_stages (agency_id, campaign_id, name, position)
      values (p_agency_id, p_campaign_id, v_item.value ->> 'name',
              (v_item.ordinality - 1)::smallint)
      returning id into v_id;
    else
      if v_id = any (v_ids) then
        raise exception 'Étapes invalides' using errcode = '22023';
      end if;
      update public.campaign_stages
      set name = v_item.value ->> 'name',
          position = (v_item.ordinality - 1)::smallint
      where id = v_id and campaign_id = p_campaign_id and agency_id = p_agency_id;
      if not found then
        raise exception 'Étape introuvable' using errcode = '22023';
      end if;
    end if;
    v_ids := v_ids || v_id;
  end loop;

  -- Étapes retirées : leurs dossiers reculent à l'étape gardée précédente
  for i in 1 .. coalesce(array_length(v_old, 1), 0) loop
    if not (v_old[i] = any (v_ids)) then
      v_target := null;
      for j in reverse i - 1 .. 1 loop
        if v_old[j] = any (v_ids) then
          v_target := v_old[j];
          exit;
        end if;
      end loop;
      v_target := coalesce(v_target, v_ids[1]);

      update public.cases set stage_id = v_target
      where stage_id = v_old[i] and agency_id = p_agency_id;
      get diagnostics v_count = row_count;
      v_moved := v_moved + v_count;

      delete from public.campaign_stages where id = v_old[i];
    end if;
  end loop;

  if v_ids[1] is not null then
    update public.cases set stage_id = v_ids[1]
    where campaign_id = p_campaign_id and agency_id = p_agency_id
      and stage_id is null;
    get diagnostics v_count = row_count;
    v_moved := v_moved + v_count;
  end if;

  return v_moved;
end;
$$;

-- Change l'étape d'un dossier (tout membre actif). Renvoie l'ancienne étape.
-- La clé composite refuse une étape d'une autre campagne (23503).
create function public.set_case_stage(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_stage_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old uuid;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  if p_stage_id is null then
    raise exception 'Étape invalide' using errcode = '22023';
  end if;

  select stage_id into v_old
  from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  update public.cases
  set stage_id = p_stage_id
  where id = p_case_id and agency_id = p_agency_id
    and stage_id is distinct from p_stage_id;

  return v_old;
end;
$$;

-- Création d'une campagne : ses étapes de départ ------------------------------
-- Mêmes étapes qu'avant, plus p_stages (noms dans l'ordre, 15 au plus).

drop function public.create_campaign(uuid, uuid, text, text, text[], jsonb, jsonb, text[], integer);

create function public.create_campaign(
  p_agency_id uuid,
  p_actor_id uuid,
  p_name text,
  p_template_key text,
  p_suggested_platforms text[],
  p_dates jsonb,
  p_infos jsonb,
  p_groups text[],
  p_default_fee integer default null,
  p_stages text[] default '{}'
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
  if cardinality(coalesce(p_stages, '{}')) > 15
     or (select count(distinct lower(btrim(s))) from unnest(coalesce(p_stages, '{}')) as s)
        <> cardinality(coalesce(p_stages, '{}')) then
    raise exception 'Étapes invalides' using errcode = '22023';
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

  insert into public.campaign_stages (agency_id, campaign_id, name, position)
  select p_agency_id, v_id, s.name, (s.ordinality - 1)::smallint
  from unnest(coalesce(p_stages, '{}')) with ordinality as s(name, ordinality);

  return v_id;
end;
$$;

-- Campagnes existantes ---------------------------------------------------------
-- Les campagnes actives reçoivent des étapes (celles du modèle Campus France
-- s'il en vient, sinon la liste par défaut de l'application) et leurs
-- dossiers la première. Les campagnes archivées n'en reçoivent pas : leurs
-- dossiers sont terminés. Les déclencheurs des dossiers sont suspendus le
-- temps du remplissage (une agence en lecture seule refuserait l'écriture,
-- et la date de modification des dossiers ne doit pas changer).

insert into public.campaign_stages (agency_id, campaign_id, name, position)
select c.agency_id, c.id, s.name, (s.ordinality - 1)::smallint
from public.campaigns c
cross join lateral unnest(
  case when c.template_key like 'campus-france-%'
    then array['Constitution du dossier', 'Dossier soumis à Campus France',
               'Entretien', 'Réponses des établissements', 'Demande de visa']
    else array['Constitution du dossier', 'Candidatures envoyées',
               'Réponses des établissements', 'Demande de visa']
  end
) with ordinality as s(name, ordinality)
where c.status = 'active';

alter table public.cases disable trigger user;

update public.cases c
set stage_id = s.id
from public.campaign_stages s
where s.campaign_id = c.campaign_id and s.position = 0;

alter table public.cases enable trigger user;

-- Données de l'agence : refusées en lecture seule (voir subscriptions)
create trigger campaign_stages_writable
  before insert or update or delete on public.campaign_stages
  for each row execute function public.enforce_agency_writable();

-- Droits ----------------------------------------------------------------------

revoke execute on function public.cases_default_stage() from public;
revoke execute on function public.replace_campaign_stages(uuid, uuid, uuid, jsonb) from public;
revoke execute on function public.set_case_stage(uuid, uuid, uuid, uuid) from public;
revoke execute on function public.create_campaign(
  uuid, uuid, text, text, text[], jsonb, jsonb, text[], integer, text[]) from public;

grant execute on function public.replace_campaign_stages(uuid, uuid, uuid, jsonb)
  to service_role;
grant execute on function public.set_case_stage(uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.create_campaign(
  uuid, uuid, text, text, text[], jsonb, jsonb, text[], integer, text[]) to service_role;

-- Lecture seule : le serveur écrit seulement par les fonctions ci-dessus
grant select on public.campaign_stages to authenticated, service_role;
grant select on public.case_stage_stats to authenticated;

create policy "campaign_stages_select_same_agency" on public.campaign_stages
  for select to authenticated
  using (agency_id = public.current_agency_id());
