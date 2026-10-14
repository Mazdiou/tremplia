-- Migration : motivation_letters
-- 1. Lettre de motivation d'un dossier candidat : une seule par dossier,
--    texte simple, écrite par l'agence (tout membre actif). Visible par
--    toute l'agence. Le candidat pourra la consulter plus tard.
-- 2. Le dossier de documents « Lettres de motivation » n'est plus créé au
--    départ (la lettre a son propre onglet) et il est retiré des dossiers
--    existants : ses PDF passent dans « Sans dossier ».

-- 1. Lettre de motivation ----------------------------------------------------

create table public.case_motivation_letters (
  case_id uuid primary key,
  agency_id uuid not null references public.agencies (id) on delete cascade,

  -- Texte simple ; vide = lettre effacée. 10 000 caractères au plus
  content text not null check (length(content) <= 10000),

  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Dossier et profil de la même agence que la lettre. Pas de cascade : un
  -- employé qui a écrit une lettre ne peut plus être supprimé.
  constraint case_motivation_letters_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_motivation_letters_updated_by_fk foreign key (updated_by, agency_id)
    references public.profiles (id, agency_id)
);

create index case_motivation_letters_agency_idx
  on public.case_motivation_letters (agency_id);
create index case_motivation_letters_updated_by_idx
  on public.case_motivation_letters (updated_by);

alter table public.case_motivation_letters enable row level security;

-- Enregistrer la lettre (création ou remplacement) : tout membre actif de
-- l'agence. Renvoie vrai si le texte a changé.
create function public.save_motivation_letter(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_content text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  -- Verrouille le dossier : deux enregistrements simultanés se suivent
  perform 1 from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  select content into v_old
  from public.case_motivation_letters
  where case_id = p_case_id and agency_id = p_agency_id;

  if v_old is not distinct from p_content then
    return false;
  end if;

  insert into public.case_motivation_letters (case_id, agency_id, content, updated_by)
  values (p_case_id, p_agency_id, p_content, p_actor_id)
  on conflict (case_id) do update
  set content = excluded.content,
      updated_by = excluded.updated_by,
      updated_at = now();

  return true;
end;
$$;

revoke execute on function public.save_motivation_letter(uuid, uuid, uuid, text)
  from public;
grant execute on function public.save_motivation_letter(uuid, uuid, uuid, text)
  to service_role;

-- Lecture seule : le serveur écrit seulement par la fonction ci-dessus
grant select on public.case_motivation_letters to authenticated, service_role;

create policy "case_motivation_letters_select_same_agency"
  on public.case_motivation_letters
  for select to authenticated
  using (agency_id = public.current_agency_id());

-- 2. Dossiers de documents de départ ------------------------------------------

-- Même fonction, sans « Lettres de motivation »
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
    (3, 'Informations personnelles')
  ) as d(n, name)
  on conflict do nothing;

  update public.cases
  set folders_initialized_at = now()
  where id = p_case_id and agency_id = p_agency_id;

  return true;
end;
$$;

-- Retrait des dossiers « Lettres de motivation » existants. Leurs PDF passent
-- dans « Sans dossier » (clé étrangère on delete set null). Un dossier qui
-- contient un document verrouillé par le patron est conservé : le patron
-- le supprimera à la main après l'avoir déverrouillé.
delete from public.document_folders f
where lower(f.name) = 'lettres de motivation'
  and not exists (
    select 1 from public.documents d
    where d.folder_id = f.id and d.locked_at is not null
  );
