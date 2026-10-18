-- Migration : case_tasks
-- Tâches d'un dossier : une action à faire pour un candidat, avec une
-- échéance facultative et un membre de l'équipe qui en est chargé. Internes
-- à l'agence : le candidat ne les voit jamais.
-- Lecture : membres actifs de l'agence (RLS).
-- Écriture : uniquement par les fonctions ci-dessous (routes serveur).
-- Règles :
--   - créer : tout membre actif, pour lui-même ou un collègue actif ;
--   - modifier, cocher « faite », rouvrir : son auteur, son responsable, ou
--     un patron ;
--   - supprimer : son auteur, ou un patron.
-- Suppression définitive ; la trace reste dans le journal (sans le contenu).
-- 100 tâches à faire au plus par dossier.

create table public.case_tasks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,

  -- Au moins un caractère visible, 200 au plus
  title text not null check (title ~ '\S' and length(title) <= 200),
  -- Précision facultative ; jamais une chaîne vide (null à la place)
  details text check (details ~ '\S' and length(details) <= 500),
  -- Date seule, sans heure. Bornes larges : seulement contre les fautes de
  -- frappe (année 20226…)
  due_date date check (due_date between date '2020-01-01' and date '2100-12-31'),

  assigned_to uuid not null,
  created_by uuid not null,

  -- Faite : quand et par qui (les deux ou aucun)
  done_at timestamptz,
  done_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Dossier et profils de la même agence que la tâche. Pas de cascade : un
  -- employé qui a une tâche (créée, confiée ou faite) ne peut plus être
  -- supprimé, il reste désactivé.
  constraint case_tasks_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_tasks_assigned_to_fk foreign key (assigned_to, agency_id)
    references public.profiles (id, agency_id),
  constraint case_tasks_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id),
  constraint case_tasks_done_by_fk foreign key (done_by, agency_id)
    references public.profiles (id, agency_id),

  constraint case_tasks_done_consistent
    check ((done_at is null) = (done_by is null))
);

-- Tâches d'un dossier
create index case_tasks_case_idx on public.case_tasks (agency_id, case_id);
-- Tâches à faire d'une personne, par échéance (page Tâches, tableau de bord)
create index case_tasks_open_assignee_idx
  on public.case_tasks (agency_id, assigned_to, due_date)
  where done_at is null;
-- Clés étrangères vers profiles
create index case_tasks_assigned_to_idx on public.case_tasks (assigned_to);
create index case_tasks_created_by_idx on public.case_tasks (created_by);
create index case_tasks_done_by_idx on public.case_tasks (done_by);

-- Colonnes non modifiables, date de modification
create function public.case_tasks_before_update()
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
    raise exception 'Ces colonnes de la tâche ne sont pas modifiables'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger case_tasks_before_update
  before update on public.case_tasks
  for each row execute function public.case_tasks_before_update();

-- Données de l'agence : refusées en lecture seule (voir subscriptions)
create trigger case_tasks_writable
  before insert or update or delete on public.case_tasks
  for each row execute function public.enforce_agency_writable();

alter table public.case_tasks enable row level security;

-- Fonctions (serveur seulement) ---------------------------------------------

-- Le responsable doit être un membre ACTIF de l'agence
create function public.require_task_assignee(p_assigned_to uuid, p_agency_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = p_assigned_to and agency_id = p_agency_id and is_active
  ) then
    raise exception 'Responsable invalide' using errcode = '22023';
  end if;
end;
$$;

-- Ajouter une tâche : tout membre actif
create function public.create_case_task(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_title text,
  p_details text,
  p_due_date date,
  p_assigned_to uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);
  perform public.require_task_assignee(p_assigned_to, p_agency_id);

  -- Verrouille le dossier : deux ajouts simultanés ne dépassent pas la limite
  perform 1 from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  if (select count(*) from public.case_tasks
      where case_id = p_case_id and agency_id = p_agency_id and done_at is null) >= 100 then
    raise exception 'Limite de 100 tâches à faire par dossier atteinte'
      using errcode = '54000';
  end if;

  insert into public.case_tasks (
    agency_id, case_id, title, details, due_date, assigned_to, created_by
  )
  values (
    p_agency_id, p_case_id, p_title, p_details, p_due_date, p_assigned_to, p_actor_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Vérifie que l'acteur peut agir sur la tâche et la verrouille jusqu'à la
-- fin de la transaction. « edit » : auteur, responsable ou patron ;
-- « delete » : auteur ou patron. Renvoie le responsable actuel.
create function public.lock_case_task_for(
  p_task_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_mode text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_creator uuid;
  v_assignee uuid;
begin
  v_role := public.require_active_member(p_actor_id, p_agency_id);

  select created_by, assigned_to into v_creator, v_assignee
  from public.case_tasks
  where id = p_task_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Tâche introuvable' using errcode = 'P0002';
  end if;

  if v_role <> 'owner' and v_creator <> p_actor_id
     and (p_mode = 'delete' or v_assignee <> p_actor_id) then
    raise exception 'Action non autorisée sur cette tâche' using errcode = '42501';
  end if;

  return v_assignee;
end;
$$;

-- Modifier une tâche (intitulé, précision, échéance, responsable) : son
-- auteur, son responsable, ou un patron. Un nouveau responsable doit être
-- actif ; garder un responsable désactivé reste permis. Renvoie l'ancien
-- responsable (journal : « a confié la tâche à… »).
create function public.update_case_task(
  p_task_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_title text,
  p_details text,
  p_due_date date,
  p_assigned_to uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous uuid;
begin
  v_previous := public.lock_case_task_for(p_task_id, p_agency_id, p_actor_id, 'edit');
  if p_assigned_to is distinct from v_previous then
    perform public.require_task_assignee(p_assigned_to, p_agency_id);
  end if;

  update public.case_tasks
  set title = p_title,
      details = p_details,
      due_date = p_due_date,
      assigned_to = p_assigned_to
  where id = p_task_id and agency_id = p_agency_id;

  return v_previous;
end;
$$;

-- Cocher « faite » (p_done = true) ou rouvrir : son auteur, son
-- responsable, ou un patron. Renvoie true si l'état a vraiment changé. Rouvrir
-- compte dans la limite des 100 tâches à faire.
create function public.set_case_task_done(
  p_task_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_done boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case uuid;
begin
  perform public.lock_case_task_for(p_task_id, p_agency_id, p_actor_id, 'edit');

  if p_done then
    update public.case_tasks
    set done_at = now(), done_by = p_actor_id
    where id = p_task_id and agency_id = p_agency_id and done_at is null;
    return found;
  end if;

  select case_id into v_case from public.case_tasks
  where id = p_task_id and agency_id = p_agency_id and done_at is not null;
  if not found then
    return false;
  end if;

  perform 1 from public.cases where id = v_case and agency_id = p_agency_id for update;
  if (select count(*) from public.case_tasks
      where case_id = v_case and agency_id = p_agency_id and done_at is null) >= 100 then
    raise exception 'Limite de 100 tâches à faire par dossier atteinte'
      using errcode = '54000';
  end if;

  update public.case_tasks
  set done_at = null, done_by = null
  where id = p_task_id and agency_id = p_agency_id;
  return true;
end;
$$;

-- Supprimer une tâche : son auteur, ou un patron
create function public.delete_case_task(
  p_task_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_case_task_for(p_task_id, p_agency_id, p_actor_id, 'delete');

  delete from public.case_tasks
  where id = p_task_id and agency_id = p_agency_id;
end;
$$;

-- À la clôture d'un dossier : marquer faites toutes ses tâches à faire. Tout
-- membre actif, comme le changement de statut qui l'accompagne. Renvoie les
-- tâches cochées.
create function public.complete_case_tasks(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns table (task_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  perform 1 from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  return query
  update public.case_tasks
  set done_at = now(), done_by = p_actor_id
  where case_id = p_case_id and agency_id = p_agency_id and done_at is null
  returning id;
end;
$$;

-- Même tâche pour plusieurs dossiers (actions groupées) : tout membre
-- actif. Tout ou rien, 200 dossiers au plus. Renvoie chaque dossier et sa
-- nouvelle tâche.
create function public.create_cases_task(
  p_case_ids uuid[],
  p_agency_id uuid,
  p_actor_id uuid,
  p_title text,
  p_details text,
  p_due_date date,
  p_assigned_to uuid
)
returns table (case_id uuid, task_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform public.require_active_member(p_actor_id, p_agency_id);
  perform public.require_task_assignee(p_assigned_to, p_agency_id);

  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_case_ids) as x;
  if cardinality(v_ids) = 0 or cardinality(v_ids) > 200 then
    raise exception 'Demande invalide' using errcode = '22023';
  end if;

  perform 1 from public.cases c
  where c.id = any(v_ids) and c.agency_id = p_agency_id
  for update;
  if (select count(*) from public.cases c
      where c.id = any(v_ids) and c.agency_id = p_agency_id) <> cardinality(v_ids) then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.case_tasks t
    where t.case_id = any(v_ids) and t.agency_id = p_agency_id and t.done_at is null
    group by t.case_id
    having count(*) >= 100
  ) then
    raise exception 'Limite de 100 tâches à faire par dossier atteinte'
      using errcode = '54000';
  end if;

  return query
  insert into public.case_tasks as t (
    agency_id, case_id, title, details, due_date, assigned_to, created_by
  )
  select p_agency_id, x, p_title, p_details, p_due_date, p_assigned_to, p_actor_id
  from unnest(v_ids) as x
  returning t.case_id, t.id;
end;
$$;

-- Temps réel : une tâche confiée par un collègue apparaît sans recharger.
-- Chaque événement passe par le RLS : seulement les tâches de son agence.
alter publication supabase_realtime add table public.case_tasks;

-- Droits --------------------------------------------------------------------

revoke execute on function public.case_tasks_before_update() from public;
revoke execute on function public.require_task_assignee(uuid, uuid) from public;
revoke execute on function public.create_case_task(uuid, uuid, uuid, text, text, date, uuid) from public;
revoke execute on function public.lock_case_task_for(uuid, uuid, uuid, text) from public;
revoke execute on function public.update_case_task(uuid, uuid, uuid, text, text, date, uuid) from public;
revoke execute on function public.set_case_task_done(uuid, uuid, uuid, boolean) from public;
revoke execute on function public.delete_case_task(uuid, uuid, uuid) from public;
revoke execute on function public.complete_case_tasks(uuid, uuid, uuid) from public;
revoke execute on function public.create_cases_task(uuid[], uuid, uuid, text, text, date, uuid) from public;

grant execute on function public.create_case_task(uuid, uuid, uuid, text, text, date, uuid) to service_role;
grant execute on function public.update_case_task(uuid, uuid, uuid, text, text, date, uuid) to service_role;
grant execute on function public.set_case_task_done(uuid, uuid, uuid, boolean) to service_role;
grant execute on function public.delete_case_task(uuid, uuid, uuid) to service_role;
grant execute on function public.complete_case_tasks(uuid, uuid, uuid) to service_role;
grant execute on function public.create_cases_task(uuid[], uuid, uuid, text, text, date, uuid) to service_role;

-- Lecture seule : le serveur écrit seulement par les fonctions ci-dessus
grant select on public.case_tasks to authenticated, service_role;

create policy "case_tasks_select_same_agency" on public.case_tasks
  for select to authenticated
  using (agency_id = public.current_agency_id());
