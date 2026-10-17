-- Actions groupées sur les dossiers : même étape ou même responsable pour
-- plusieurs dossiers d'un coup. Tout ou rien : un seul dossier refusé
-- (autre agence, étape d'une autre campagne, agence en lecture seule) annule
-- l'ensemble. Mêmes règles que set_case_stage et set_case_assignee.
-- 200 dossiers au plus par appel (BULK_MAX_CASES, features/cases/schemas.ts).

-- Étape de plusieurs dossiers (tout membre actif). Les dossiers doivent tous
-- être de la campagne de l'étape (clé composite stage_id + campaign_id).
-- Renvoie les dossiers vraiment changés et leur ancienne étape.
create function public.set_cases_stage(
  p_case_ids uuid[],
  p_agency_id uuid,
  p_actor_id uuid,
  p_stage_id uuid
)
returns table (changed_id uuid, previous_stage_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_case_ids) as x;
  if p_stage_id is null or cardinality(v_ids) = 0 or cardinality(v_ids) > 200 then
    raise exception 'Demande invalide' using errcode = '22023';
  end if;

  perform 1 from public.cases
  where id = any(v_ids) and agency_id = p_agency_id
  for update;
  if (select count(*) from public.cases
      where id = any(v_ids) and agency_id = p_agency_id) <> cardinality(v_ids) then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  return query
  with old as (
    select c.id, c.stage_id
    from public.cases c
    where c.id = any(v_ids) and c.agency_id = p_agency_id
      and c.stage_id is distinct from p_stage_id
  ), upd as (
    update public.cases c
    set stage_id = p_stage_id
    from old
    where c.id = old.id
    returning c.id, old.stage_id
  )
  select upd.id, upd.stage_id from upd;
end;
$$;

-- Responsable de plusieurs dossiers : patron seulement, responsable actif
-- de l'agence. Renvoie les dossiers vraiment changés et leur ancien
-- responsable.
create function public.set_cases_assignee(
  p_case_ids uuid[],
  p_agency_id uuid,
  p_actor_id uuid,
  p_assigned_to uuid
)
returns table (changed_id uuid, previous_assignee uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_case_ids) as x;
  if cardinality(v_ids) = 0 or cardinality(v_ids) > 200 then
    raise exception 'Demande invalide' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_assigned_to and agency_id = p_agency_id and is_active
  ) then
    raise exception 'Responsable invalide' using errcode = '22023';
  end if;

  perform 1 from public.cases
  where id = any(v_ids) and agency_id = p_agency_id
  for update;
  if (select count(*) from public.cases
      where id = any(v_ids) and agency_id = p_agency_id) <> cardinality(v_ids) then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  return query
  with old as (
    select c.id, c.assigned_to
    from public.cases c
    where c.id = any(v_ids) and c.agency_id = p_agency_id
      and c.assigned_to is distinct from p_assigned_to
  ), upd as (
    update public.cases c
    set assigned_to = p_assigned_to
    from old
    where c.id = old.id
    returning c.id, old.assigned_to
  )
  select upd.id, upd.assigned_to from upd;
end;
$$;

-- Droits ----------------------------------------------------------------------

revoke execute on function public.set_cases_stage(uuid[], uuid, uuid, uuid) from public;
revoke execute on function public.set_cases_assignee(uuid[], uuid, uuid, uuid) from public;
grant execute on function public.set_cases_stage(uuid[], uuid, uuid, uuid) to service_role;
grant execute on function public.set_cases_assignee(uuid[], uuid, uuid, uuid) to service_role;
