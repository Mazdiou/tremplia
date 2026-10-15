-- Migration : case_program_results
-- Réponse de l'établissement pour chaque formation visée : sans réponse,
-- candidature envoyée, acceptée, liste d'attente ou refusée. Tout membre actif
-- la note ; le candidat la voit dans son espace.
-- La réponse ne fait pas partie de ce que le candidat valide : la noter ne
-- remet pas son avis « en attente » (l'empreinte du contenu ne la lit pas).

alter table public.case_programs
  add column result text not null default 'none'
    check (result in ('none', 'sent', 'accepted', 'waitlisted', 'rejected'));

-- Noter la réponse. Renvoie vrai si elle a changé.
create function public.set_case_program_result(
  p_program_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_result text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_case_programs(p_case_id, p_agency_id, p_actor_id);

  update public.case_programs
  set result = p_result,
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_program_id
    and case_id = p_case_id
    and agency_id = p_agency_id
    and result is distinct from p_result;
  if found then
    return true;
  end if;

  if not exists (
    select 1 from public.case_programs
    where id = p_program_id and case_id = p_case_id and agency_id = p_agency_id
  ) then
    raise exception 'Formation introuvable' using errcode = 'P0002';
  end if;
  return false;
end;
$$;

-- Seules les modifications du contenu validé par le candidat (ajout,
-- suppression, rang, intitulé, niveau, ville, établissement) redemandent
-- son avis ; la réponse de l'établissement, non.
drop trigger case_programs_reset_review on public.case_programs;
create trigger case_programs_reset_review
  after insert or delete or update of position, title, level, city, institution
  on public.case_programs
  for each row execute function public.reset_student_review();

-- Droits --------------------------------------------------------------------

revoke execute on function public.set_case_program_result(uuid, uuid, uuid, uuid, text)
  from public;
grant execute on function public.set_case_program_result(uuid, uuid, uuid, uuid, text)
  to service_role;
