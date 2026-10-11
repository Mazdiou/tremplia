-- Migration : document_folders
-- Dossiers de rangement des documents d'un dossier candidat (un seul niveau).
-- Chaque dossier candidat reçoit 4 dossiers de départ (créés à la première
-- ouverture de l'onglet Documents) ; l'agence peut ensuite en créer, renommer
-- et supprimer librement. Aucun PDF n'est supprimé avec un dossier : ses
-- documents passent dans « Sans dossier » (folder_id vide).
-- Lecture : utilisateurs actifs de l'agence (RLS).
-- Écriture : routes serveur uniquement.
-- Suppression : patron seul, par la fonction delete_document_folder.

create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,

  -- Pas d'espace avant ni après, 80 caractères au maximum
  name text not null check (length(name) between 1 and 80 and name = btrim(name)),

  -- Vide pour les dossiers de départ ; sinon l'auteur (devient vide si
  -- l'employé est supprimé : un dossier de rangement n'est pas de l'historique).
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Le dossier candidat et l'auteur appartiennent à la même agence.
  constraint document_folders_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint document_folders_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id) on delete set null (created_by),

  -- Nécessaire au lien composite depuis documents
  constraint document_folders_id_case_agency_unique unique (id, case_id, agency_id)
);

-- Un nom par dossier candidat, sans tenir compte des majuscules
create unique index document_folders_name_unique
  on public.document_folders (case_id, lower(name));
create index document_folders_agency_case_idx
  on public.document_folders (agency_id, case_id);
create index document_folders_created_by_idx on public.document_folders (created_by);

-- Colonnes non modifiables, date de modification
create or replace function public.document_folders_before_update()
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
    -- created_by peut seulement devenir vide quand le profil est supprimé
    if not (new.created_by is null
            and new.id = old.id
            and new.agency_id = old.agency_id
            and new.case_id = old.case_id
            and new.created_at = old.created_at) then
      raise exception 'Ces colonnes du dossier de documents ne sont pas modifiables'
        using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger document_folders_before_update
  before update on public.document_folders
  for each row execute function public.document_folders_before_update();

-- Un dossier qui contient un document verrouillé ne peut pas être supprimé
create or replace function public.document_folders_before_delete()
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

-- Les documents liés à ce dossier (voir plus bas) ne sont pas supprimés avec lui :
-- la clé étrangère remet leur folder_id à vide.

alter table public.document_folders enable row level security;

revoke all on public.document_folders from anon, authenticated;
grant select on public.document_folders to authenticated;
-- Routes serveur : lecture, ajout, renommage. Pas de delete direct :
-- la suppression passe par delete_document_folder (contrôle du patron).
grant select, insert, update on public.document_folders to service_role;

create policy "document_folders_select_same_agency" on public.document_folders
  for select to authenticated
  using (agency_id = public.current_agency_id());

-- Rangement des documents ---------------------------------------------------

alter table public.documents add column folder_id uuid;

-- Le dossier de rangement appartient au même dossier candidat et à la même
-- agence que le document. Supprimer le dossier de rangement remet folder_id à vide.
alter table public.documents
  add constraint documents_folder_fk foreign key (folder_id, case_id, agency_id)
    references public.document_folders (id, case_id, agency_id)
    on delete set null (folder_id);

create index documents_folder_idx on public.documents (folder_id);

create trigger document_folders_before_delete
  before delete on public.document_folders
  for each row execute function public.document_folders_before_delete();

-- Même règle que le renommage : un document verrouillé ne se déplace pas.
create or replace function public.documents_before_update()
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

  -- Un document verrouillé ne peut pas être renommé ni déplacé
  -- (même en même temps qu'on le déverrouille)
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

-- Fonctions (serveur seulement) --------------------------------------------

-- Supprime un dossier de rangement : patron actif de l'agence seulement.
-- Les documents qu'il contient passent dans « Sans dossier ».
create or replace function public.delete_document_folder(
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
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id
      and agency_id = p_agency_id
      and role = 'owner'
      and is_active
  ) then
    raise exception 'Seul un patron actif peut supprimer un dossier de documents'
      using errcode = '42501';
  end if;

  delete from public.document_folders
  where id = p_folder_id and agency_id = p_agency_id;

  if not found then
    raise exception 'Dossier de documents introuvable' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_document_folder(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.delete_document_folder(uuid, uuid, uuid)
  to service_role;

-- Crée les 4 dossiers de départ d'un dossier candidat, UNE seule fois.
-- cases.folders_initialized_at évite de les recréer si l'agence les supprime.
-- Renvoie vrai si les dossiers viennent d'être créés, faux s'ils l'étaient déjà.
alter table public.cases add column folders_initialized_at timestamptz;

create or replace function public.ensure_default_document_folders(
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
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and agency_id = p_agency_id and is_active
  ) then
    raise exception 'Utilisateur invalide' using errcode = '42501';
  end if;

  -- Verrouille le dossier candidat (de la bonne agence) : deux ouvertures
  -- simultanées de l'onglet ne créent pas les dossiers en double.
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

  -- Si l'agence avait déjà un dossier du même nom, il est conservé
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

revoke all on function public.ensure_default_document_folders(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.ensure_default_document_folders(uuid, uuid, uuid)
  to service_role;
