-- Migration : activity_log
-- Journal d'activité de l'agence : écrit par le serveur uniquement, en
-- insertion seule (ni modification ni suppression), lu par le patron seul.
-- `details` ne contient jamais de donnée personnelle ni de secret :
-- seulement des identifiants, des noms de champs et des statuts.

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- Sans clé étrangère : la trace reste même si l'employé est supprimé
  actor_id uuid,
  -- Liste des actions : src/lib/audit/actions.ts
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_type text check (target_type ~ '^[a-z_]+$'),
  target_id uuid,
  case_id uuid,
  details jsonb not null default '{}' check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),

  -- Le dossier appartient à la même agence que la ligne de journal. Pas de
  -- cascade : un dossier n'est jamais supprimé.
  constraint activity_log_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id)
);

-- Activité récente de l'agence (tableau de bord)
create index activity_log_agency_created_idx
  on public.activity_log (agency_id, created_at desc);
-- Historique d'un dossier
create index activity_log_case_idx
  on public.activity_log (agency_id, case_id, created_at desc)
  where case_id is not null;

alter table public.activity_log enable row level security;

grant select on public.activity_log to authenticated;
grant select, insert on public.activity_log to service_role;

create policy "activity_log_select_owner" on public.activity_log
  for select to authenticated
  using (agency_id = public.current_agency_id() and public.is_owner());
