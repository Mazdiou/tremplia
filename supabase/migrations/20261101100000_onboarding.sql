-- Migration : onboarding
-- Guide de démarrage d'une nouvelle agence : mot de bienvenue (une fois par
-- membre) et liste « Bien démarrer » du tableau de bord (patron).
--
-- Les étapes ne sont pas stockées : elles se lisent dans les vraies données
-- (onboarding_progress). Seuls sont gardés le moment où le patron masque la
-- liste et celui où chaque membre a vu le mot de bienvenue.
-- Les agences et membres déjà inscrits sont marqués comme ayant tout vu.

alter table public.agencies
  add column onboarding_hidden_at timestamptz;

alter table public.profiles
  add column welcomed_at timestamptz;

update public.agencies set onboarding_hidden_at = now();
update public.profiles set welcomed_at = now();

-- Avancement du guide : chaque étape est faite dès que la donnée existe.
-- `latest_case_id` : le dernier dossier créé, où mènent les étapes qui en
-- demandent un. Patron seulement.
create function public.onboarding_progress(p_agency_id uuid, p_actor_id uuid)
returns table (
  hidden boolean,
  has_campaign boolean,
  has_case boolean,
  has_document boolean,
  has_student_access boolean,
  has_task boolean,
  has_employee boolean,
  latest_case_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  return query
  select
    a.onboarding_hidden_at is not null,
    exists (select 1 from public.campaigns c where c.agency_id = p_agency_id),
    exists (select 1 from public.cases c where c.agency_id = p_agency_id),
    exists (select 1 from public.documents d where d.agency_id = p_agency_id),
    exists (select 1 from public.case_student_access s where s.agency_id = p_agency_id),
    exists (select 1 from public.case_tasks t where t.agency_id = p_agency_id),
    exists (select 1 from public.profiles p
            where p.agency_id = p_agency_id and p.id <> p_actor_id),
    (select c.id from public.cases c
     where c.agency_id = p_agency_id
     order by c.created_at desc, c.id
     limit 1)
  from public.agencies a
  where a.id = p_agency_id;
end;
$$;

-- Masquer ou réafficher la liste (patron). Une préférence d'affichage :
-- permise même en lecture seule.
create function public.set_onboarding_hidden(
  p_agency_id uuid,
  p_actor_id uuid,
  p_hidden boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  update public.agencies
  set onboarding_hidden_at = case when p_hidden then now() end
  where id = p_agency_id;
end;
$$;

-- Mot de bienvenue vu (le membre lui-même). La colonne n'est pas suivie par
-- profiles_writable : permis même en lecture seule. La première date reste.
create function public.mark_welcomed(p_agency_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member(p_user_id, p_agency_id);

  update public.profiles
  set welcomed_at = coalesce(welcomed_at, now())
  where id = p_user_id and agency_id = p_agency_id;
end;
$$;

-- Droits ----------------------------------------------------------------------

revoke execute on function public.onboarding_progress(uuid, uuid) from public;
revoke execute on function public.set_onboarding_hidden(uuid, uuid, boolean) from public;
revoke execute on function public.mark_welcomed(uuid, uuid) from public;

grant execute on function public.onboarding_progress(uuid, uuid) to service_role;
grant execute on function public.set_onboarding_hidden(uuid, uuid, boolean) to service_role;
grant execute on function public.mark_welcomed(uuid, uuid) to service_role;
