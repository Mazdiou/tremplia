-- Tâches : clôture du dossier en une seule opération, suppressions en temps réel.

-- 1. Clore (ou abandonner) un dossier et marquer faites ses tâches à faire,
-- tout ou rien. Avant, le serveur faisait deux appels : si le second
-- échouait, le dossier était clos avec des tâches encore à faire. Tout
-- membre actif, comme set_case_status. Renvoie l'ancien statut et le nombre
-- de tâches cochées.
create function public.close_case_with_tasks(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_status text
)
returns table (previous_status text, completed_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('closed', 'abandoned') then
    raise exception 'Statut invalide' using errcode = '22023';
  end if;

  previous_status := public.set_case_status(p_case_id, p_agency_id, p_actor_id, p_status);

  select count(*)::integer into completed_count
  from public.complete_case_tasks(p_case_id, p_agency_id, p_actor_id);

  return next;
end;
$$;

revoke execute on function public.close_case_with_tasks(uuid, uuid, uuid, text) from public;
grant execute on function public.close_case_with_tasks(uuid, uuid, uuid, text) to service_role;

-- 2. Une tâche supprimée doit disparaître chez les collègues sans attendre.
-- Avec l'identité par défaut, l'événement de suppression ne porte que l'id :
-- le filtre agency_id=eq.… de l'abonnement ne peut pas le reconnaître et
-- l'événement n'arrive pas. Avec l'identité complète, le filtre s'applique ;
-- le RLS étant actif, Supabase n'envoie toujours que l'id de la ligne.
alter table public.case_tasks replica identity full;
