-- Migration : case_notes
-- Notes internes d'un dossier candidat (visibles par toute l'agence).
-- Lecture : utilisateurs actifs de l'agence (RLS).
-- Écriture : uniquement par les fonctions ci-dessous (routes serveur).
-- Règle : un employé ne modifie et ne supprime que SES notes ; un patron
-- actif de l'agence peut tout modifier et tout supprimer. La règle est
-- vérifiée ici, dans la base, pas seulement dans les routes.
-- Suppression définitive ; la trace reste dans le journal (sans le contenu).

create table public.case_notes (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,
  author_id uuid not null,

  -- Au moins un caractère visible, 5000 au maximum
  content text not null check (content ~ '\S' and length(content) <= 5000),

  -- Renseignés dès que la note a été modifiée (par l'auteur ou par un patron)
  edited_at timestamptz,
  edited_by uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Le dossier et les profils appartiennent à la même agence que la note.
  -- Pas de suppression en cascade : un employé qui a écrit ou modifié une note
  -- ne peut plus être supprimé (désactivation seulement).
  constraint case_notes_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_notes_author_fk foreign key (author_id, agency_id)
    references public.profiles (id, agency_id),
  constraint case_notes_edited_by_fk foreign key (edited_by, agency_id)
    references public.profiles (id, agency_id),

  constraint case_notes_edit_consistent
    check ((edited_at is null) = (edited_by is null))
);

create index case_notes_case_idx
  on public.case_notes (agency_id, case_id, created_at desc);
create index case_notes_author_idx on public.case_notes (author_id);
create index case_notes_edited_by_idx on public.case_notes (edited_by);

-- Colonnes non modifiables, date de modification
create or replace function public.case_notes_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.agency_id is distinct from old.agency_id
     or new.case_id is distinct from old.case_id
     or new.author_id is distinct from old.author_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Ces colonnes de la note ne sont pas modifiables'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger case_notes_before_update
  before update on public.case_notes
  for each row execute function public.case_notes_before_update();

alter table public.case_notes enable row level security;

revoke all on public.case_notes from anon, authenticated;
grant select on public.case_notes to authenticated;
-- Le serveur lit ; il écrit seulement par les trois fonctions plus bas.
grant select on public.case_notes to service_role;

create policy "case_notes_select_same_agency" on public.case_notes
  for select to authenticated
  using (agency_id = public.current_agency_id());

-- Ajouter une note : tout utilisateur actif de l'agence --------------------
create or replace function public.create_case_note(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and agency_id = p_agency_id and is_active
  ) then
    raise exception 'Utilisateur invalide' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.cases
    where id = p_case_id and agency_id = p_agency_id
  ) then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  insert into public.case_notes (agency_id, case_id, author_id, content)
  values (p_agency_id, p_case_id, p_actor_id, p_content)
  returning id into v_id;

  return v_id;
end;
$$;

-- Modifier une note : son auteur, ou un patron actif de l'agence ------------
create or replace function public.update_case_note(
  p_note_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_content text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_author uuid;
begin
  select role into v_role
  from public.profiles
  where id = p_actor_id and agency_id = p_agency_id and is_active;
  if not found then
    raise exception 'Utilisateur invalide' using errcode = '42501';
  end if;

  select author_id into v_author
  from public.case_notes
  where id = p_note_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Note introuvable' using errcode = 'P0002';
  end if;

  if v_author <> p_actor_id and v_role <> 'owner' then
    raise exception 'Vous ne pouvez modifier que vos propres notes'
      using errcode = '42501';
  end if;

  update public.case_notes
  set content = p_content,
      edited_at = now(),
      edited_by = p_actor_id
  where id = p_note_id and agency_id = p_agency_id;
end;
$$;

-- Supprimer une note : son auteur, ou un patron actif de l'agence -----------
create or replace function public.delete_case_note(
  p_note_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_author uuid;
begin
  select role into v_role
  from public.profiles
  where id = p_actor_id and agency_id = p_agency_id and is_active;
  if not found then
    raise exception 'Utilisateur invalide' using errcode = '42501';
  end if;

  select author_id into v_author
  from public.case_notes
  where id = p_note_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Note introuvable' using errcode = 'P0002';
  end if;

  if v_author <> p_actor_id and v_role <> 'owner' then
    raise exception 'Vous ne pouvez supprimer que vos propres notes'
      using errcode = '42501';
  end if;

  delete from public.case_notes
  where id = p_note_id and agency_id = p_agency_id;
end;
$$;

revoke all on function public.create_case_note(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.update_case_note(uuid, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.delete_case_note(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_case_note(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.update_case_note(uuid, uuid, uuid, text)
  to service_role;
grant execute on function public.delete_case_note(uuid, uuid, uuid)
  to service_role;
