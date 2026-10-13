-- Migration : documents
-- Documents PDF d'un dossier (noms libres, 10 Mo au plus) et dossiers de
-- rangement de ces documents (un seul niveau).
-- Lecture : membres actifs de l'agence (RLS).
-- Écriture : routes serveur. Le verrouillage d'un document et la
-- suppression d'un dossier de documents sont réservés au patron (fonctions).
-- Un document verrouillé ne peut être ni renommé, ni déplacé, ni supprimé
-- (garanti par des triggers, donc même en cas de bug dans une route).

-- Dossiers de documents -----------------------------------------------------

-- Chaque dossier candidat reçoit 4 dossiers de départ, une seule fois
-- (cases.folders_initialized_at) ; l'agence en crée, renomme et supprime
-- ensuite librement. Supprimer un dossier ne supprime aucun PDF : ses
-- documents passent dans « Sans dossier ».
create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,
  name text not null check (public.is_clean_text(name, 80)),
  -- Vide pour les dossiers de départ ; devient vide si l'employé est
  -- supprimé (un dossier de rangement n'est pas de l'historique).
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint document_folders_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint document_folders_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id) on delete set null (created_by),
  -- Cible du lien composite depuis documents
  constraint document_folders_id_case_agency_unique unique (id, case_id, agency_id)
);

-- Un nom par dossier candidat, majuscules ignorées (sert aussi à lire les
-- dossiers de documents d'un dossier candidat)
create unique index document_folders_name_unique
  on public.document_folders (case_id, lower(name));
create index document_folders_created_by_idx on public.document_folders (created_by);

-- Colonnes non modifiables (created_by peut seulement devenir vide),
-- date de modification
create function public.document_folders_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.agency_id is distinct from old.agency_id
     or new.case_id is distinct from old.case_id
     or new.created_at is distinct from old.created_at
     or (new.created_by is distinct from old.created_by
         and new.created_by is not null) then
    raise exception 'Ces colonnes du dossier de documents ne sont pas modifiables'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger document_folders_before_update
  before update on public.document_folders
  for each row execute function public.document_folders_before_update();

-- Documents -----------------------------------------------------------------

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,
  -- Vide : « Sans dossier »
  folder_id uuid,

  -- Nom libre donné par l'agence
  name text not null check (length(trim(name)) between 1 and 120),
  -- Nom du fichier envoyé, pour information seulement
  original_file_name text not null
    check (length(trim(original_file_name)) between 1 and 255),

  -- Toujours agency_id/case_id/document_id.pdf : jamais un nom saisi
  storage_path text not null unique,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),

  uploaded_by uuid not null,
  locked_at timestamptz,
  locked_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Dossier candidat, dossier de rangement et profils sont de la même agence
  -- (et le dossier de rangement, du même dossier candidat). Pas de cascade
  -- vers les profils : un employé qui a envoyé ou verrouillé un document ne
  -- peut plus être supprimé (désactivation seulement).
  constraint documents_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint documents_folder_fk foreign key (folder_id, case_id, agency_id)
    references public.document_folders (id, case_id, agency_id)
    on delete set null (folder_id),
  constraint documents_uploaded_by_fk foreign key (uploaded_by, agency_id)
    references public.profiles (id, agency_id),
  constraint documents_locked_by_fk foreign key (locked_by, agency_id)
    references public.profiles (id, agency_id),

  constraint documents_lock_consistent
    check ((locked_at is null) = (locked_by is null)),
  constraint documents_path_format check (
    storage_path = agency_id::text || '/' || case_id::text || '/' || id::text || '.pdf'
  )
);

-- Documents d'un dossier candidat, du plus récent au plus ancien
create index documents_case_idx
  on public.documents (agency_id, case_id, created_at desc);
-- Clés étrangères : suppression d'un dossier de rangement ou d'un profil
create index documents_folder_idx on public.documents (folder_id);
create index documents_uploaded_by_idx on public.documents (uploaded_by);
create index documents_locked_by_idx on public.documents (locked_by);

-- Colonnes non modifiables ; un document verrouillé ne se renomme ni ne se
-- déplace (même en même temps qu'on le déverrouille) ; date de modification
create function public.documents_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.agency_id is distinct from old.agency_id
     or new.case_id is distinct from old.case_id
     or new.storage_path is distinct from old.storage_path
     or new.size_bytes is distinct from old.size_bytes
     or new.original_file_name is distinct from old.original_file_name
     or new.uploaded_by is distinct from old.uploaded_by
     or new.created_at is distinct from old.created_at then
    raise exception 'Ces colonnes du document ne sont pas modifiables'
      using errcode = '42501';
  end if;

  if old.locked_at is not null
     and (new.name is distinct from old.name
          or new.folder_id is distinct from old.folder_id) then
    raise exception 'Document verrouillé : il ne peut plus être renommé ni déplacé'
      using errcode = '55006';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger documents_before_update
  before update on public.documents
  for each row execute function public.documents_before_update();

create function public.documents_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.locked_at is not null then
    raise exception 'Document verrouillé : il ne peut plus être supprimé'
      using errcode = '55006';
  end if;
  return old;
end;
$$;

create trigger documents_before_delete
  before delete on public.documents
  for each row execute function public.documents_before_delete();

-- Un dossier de documents qui contient un document verrouillé ne se supprime pas
create function public.document_folders_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.documents
    where folder_id = old.id and locked_at is not null
  ) then
    raise exception 'Ce dossier contient un document verrouillé : il ne peut pas être supprimé'
      using errcode = '55006';
  end if;
  return old;
end;
$$;

create trigger document_folders_before_delete
  before delete on public.document_folders
  for each row execute function public.document_folders_before_delete();

alter table public.document_folders enable row level security;
alter table public.documents enable row level security;

-- Fonctions (serveur seulement) ---------------------------------------------

-- Verrouiller / déverrouiller un document : patron actif de l'agence.
create function public.set_document_lock(
  p_document_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_locked boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  update public.documents
  set locked_at = case when p_locked then coalesce(locked_at, now()) end,
      locked_by = case when p_locked then coalesce(locked_by, p_actor_id) end
  where id = p_document_id and agency_id = p_agency_id;

  if not found then
    raise exception 'Document introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Supprimer un dossier de documents : patron actif de l'agence. Ses
-- documents passent dans « Sans dossier ».
create function public.delete_document_folder(
  p_folder_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  delete from public.document_folders
  where id = p_folder_id and agency_id = p_agency_id;

  if not found then
    raise exception 'Dossier de documents introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Crée les 4 dossiers de départ d'un dossier candidat, UNE seule fois
-- (tout membre actif, à la première ouverture de l'onglet Documents).
-- Renvoie vrai s'ils viennent d'être créés, faux s'ils l'étaient déjà.
create function public.ensure_default_document_folders(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_done timestamptz;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  -- Verrouille le dossier candidat : deux ouvertures simultanées de
  -- l'onglet ne créent pas les dossiers en double.
  select folders_initialized_at into v_done
  from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;
  if v_done is not null then
    return false;
  end if;

  -- Un dossier du même nom déjà créé par l'agence est conservé
  insert into public.document_folders (agency_id, case_id, name, created_at)
  select p_agency_id, p_case_id, d.name, now() + d.n * interval '1 millisecond'
  from (values
    (1, 'Candidature'),
    (2, 'Visa'),
    (3, 'Informations personnelles'),
    (4, 'Lettres de motivation')
  ) as d(n, name)
  on conflict do nothing;

  update public.cases
  set folders_initialized_at = now()
  where id = p_case_id and agency_id = p_agency_id;

  return true;
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on all functions in schema public from public;

grant execute on function public.set_document_lock(uuid, uuid, uuid, boolean)
  to service_role;
grant execute on function public.delete_document_folder(uuid, uuid, uuid)
  to service_role;
grant execute on function public.ensure_default_document_folders(uuid, uuid, uuid)
  to service_role;

grant select on public.document_folders, public.documents to authenticated;
-- Routes serveur : ajout, renommage, déplacement, suppression d'un document
-- (si non verrouillé) ; ajout et renommage d'un dossier de documents. Le
-- verrou et la suppression d'un dossier passent par les fonctions.
grant select, insert, delete on public.documents to service_role;
grant update (name, folder_id) on public.documents to service_role;
grant select, insert on public.document_folders to service_role;
grant update (name) on public.document_folders to service_role;

create policy "document_folders_select_same_agency" on public.document_folders
  for select to authenticated
  using (agency_id = public.current_agency_id());

create policy "documents_select_same_agency" on public.documents
  for select to authenticated
  using (agency_id = public.current_agency_id());

-- Stockage privé des PDF. Aucune règle sur storage.objects : ni les
-- visiteurs ni les utilisateurs connectés n'y ont accès direct ; le serveur
-- envoie (URL signée d'envoi) et lit (URL signée d'une minute).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('case-documents', 'case-documents', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
