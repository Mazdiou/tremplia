-- Migration : case_last_activity
-- Dernière action de l'agence sur chaque dossier, pour le widget « Dossiers
-- sans nouvelles » du tableau de bord. Le journal (activity_log) n'est lisible
-- que par le patron : cette table n'en garde que la date, lisible par toute
-- l'agence, tenue à jour à chaque ligne de journal écrite par un membre
-- (les actions du candidat, sans auteur, ne comptent pas).

create table public.case_last_activity (
  case_id uuid primary key,
  agency_id uuid not null,
  last_at timestamptz not null,
  constraint case_last_activity_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id) on delete cascade
);

alter table public.case_last_activity enable row level security;

create policy "case_last_activity_select_same_agency" on public.case_last_activity
  for select to authenticated
  using (agency_id = public.current_agency_id());

create function public.activity_log_touch_case()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.case_last_activity (case_id, agency_id, last_at)
  values (new.case_id, new.agency_id, new.created_at)
  on conflict (case_id) do update
    set last_at = greatest(public.case_last_activity.last_at, excluded.last_at);
  return new;
end;
$$;

create trigger activity_log_touch_case
  after insert on public.activity_log
  for each row
  when (new.case_id is not null and new.actor_id is not null)
  execute function public.activity_log_touch_case();

-- Dossiers existants : d'après le journal déjà écrit
insert into public.case_last_activity (case_id, agency_id, last_at)
select case_id, agency_id, max(created_at)
from public.activity_log
where case_id is not null and actor_id is not null
group by case_id, agency_id;

-- Dossier et date de sa dernière action (sa création s'il n'y en a pas eu).
-- security_invoker : lu à travers le RLS de cases, comme case_stats.
create view public.case_activity
with (security_invoker = true)
as
select
  c.id,
  c.campaign_id,
  c.first_name,
  c.last_name,
  c.status,
  c.assigned_to,
  greatest(c.created_at, l.last_at) as last_activity_at
from public.cases c
left join public.case_last_activity l on l.case_id = c.id;

grant select on public.case_last_activity to authenticated;
grant select on public.case_activity to authenticated;

revoke execute on function public.activity_log_touch_case() from public;
