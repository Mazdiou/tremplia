-- Migration : onboarding_signup
-- Guide de démarrage : une étape de plus, « Ouvrir votre page d'inscription
-- en ligne », faite quand la page est réellement ouverte aux candidats
-- (activée, avec au moins une campagne active proposée).
-- Même fonction qu'avant (migration document_requests), avec la colonne
-- has_signup_page en plus : elle change de type de retour, d'où sa
-- recréation.

drop function public.onboarding_progress(uuid, uuid);

create function public.onboarding_progress(p_agency_id uuid, p_actor_id uuid)
returns table (
  hidden boolean,
  has_campaign boolean,
  has_case boolean,
  has_document boolean,
  has_student_access boolean,
  has_task boolean,
  has_employee boolean,
  has_signup_page boolean,
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
    exists (select 1 from public.documents d
            where d.agency_id = p_agency_id and not d.sent_by_student),
    exists (select 1 from public.case_student_access s where s.agency_id = p_agency_id),
    exists (select 1 from public.case_tasks t where t.agency_id = p_agency_id),
    exists (select 1 from public.profiles p
            where p.agency_id = p_agency_id and p.id <> p_actor_id),
    a.signup_enabled and exists (
      select 1 from public.campaigns c
      where c.agency_id = p_agency_id and c.status = 'active' and c.signup_open),
    (select c.id from public.cases c
     where c.agency_id = p_agency_id
     order by c.created_at desc, c.id
     limit 1)
  from public.agencies a
  where a.id = p_agency_id;
end;
$$;

-- Droits ---------------------------------------------------------------------

revoke execute on function public.onboarding_progress(uuid, uuid) from public;
grant execute on function public.onboarding_progress(uuid, uuid) to service_role;
