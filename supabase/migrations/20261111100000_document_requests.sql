-- Migration : document_requests
-- Pièces demandées au candidat. L'agence liste les pièces attendues
-- (Passeport, Relevé de notes…) ; le candidat, depuis son espace, envoie un
-- PDF pour chacune, puis peut le remplacer ou le retirer tant qu'un membre
-- n'a pas accepté la pièce.
-- - Pièce demandée : tout membre actif la crée (30 par dossier au plus), la
--   renomme, change son dossier de rangement, l'accepte ou la retire, par
--   les fonctions ci-dessous. Retirer une pièce garde le document reçu.
-- - Envoi du candidat : par les fonctions ci-dessous, qui revérifient sa
--   session (accès ouvert, même génération). Le document reçu est un
--   document ordinaire du dossier, sans auteur parmi les membres
--   (sent_by_student), nommé comme la pièce et rangé dans son dossier.
-- - Le candidat ne touche jamais qu'au document qu'il a envoyé pour une
--   pièce non acceptée et non verrouillée.
-- - Supprimer le document reçu (agence) remet la pièce en attente.
-- - Envois préparés : 20 par heure et par dossier au plus. Ceux jamais
--   confirmés sont oubliés après un jour ; le serveur supprime alors leur
--   fichier.

-- 1. Documents envoyés par le candidat ----------------------------------------

alter table public.documents
  add column sent_by_student boolean not null default false,
  alter column uploaded_by drop not null,
  -- Un membre de l'agence, ou le candidat
  add constraint documents_author check (sent_by_student = (uploaded_by is null)),
  -- Cible du lien composite depuis les pièces demandées
  add constraint documents_id_case_agency_unique unique (id, case_id, agency_id);

-- Même fonction, sent_by_student en plus des colonnes non modifiables
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
     or new.sent_by_student is distinct from old.sent_by_student
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

-- 2. Pièces demandées ---------------------------------------------------------

create table public.case_document_requests (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,
  label text not null check (public.is_clean_text(label, 80)),
  -- Dossier de rangement du document reçu (vide : « Sans dossier »)
  folder_id uuid,
  -- Document reçu (vide : en attente)
  document_id uuid unique,
  -- Acceptée par un membre : le candidat ne peut plus la changer
  accepted_at timestamptz,
  accepted_by uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint case_document_requests_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_document_requests_folder_fk foreign key (folder_id, case_id, agency_id)
    references public.document_folders (id, case_id, agency_id)
    on delete set null (folder_id),
  constraint case_document_requests_document_fk foreign key (document_id, case_id, agency_id)
    references public.documents (id, case_id, agency_id)
    on delete set null (document_id),
  constraint case_document_requests_accepted_by_fk foreign key (accepted_by, agency_id)
    references public.profiles (id, agency_id) on delete set null (accepted_by),
  constraint case_document_requests_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id) on delete set null (created_by),
  -- accepted_by peut devenir vide (profil supprimé), pas l'inverse
  constraint case_document_requests_accepted_by_consistent
    check (accepted_at is not null or accepted_by is null),
  -- Seule une pièce reçue s'accepte
  constraint case_document_requests_accepted_document
    check (accepted_at is null or document_id is not null)
);

-- Un intitulé par dossier, majuscules ignorées (sert aussi à lire les
-- pièces d'un dossier)
create unique index case_document_requests_label_unique
  on public.case_document_requests (case_id, lower(label));
create index case_document_requests_agency_idx on public.case_document_requests (agency_id);
create index case_document_requests_folder_idx on public.case_document_requests (folder_id);
create index case_document_requests_accepted_by_idx on public.case_document_requests (accepted_by);
create index case_document_requests_created_by_idx on public.case_document_requests (created_by);

-- Colonnes non modifiables (created_by peut seulement devenir vide). Un
-- document remplacé ou supprimé n'est plus accepté. Date de modification.
create function public.case_document_requests_before_update()
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
    raise exception 'Ces colonnes de la pièce demandée ne sont pas modifiables'
      using errcode = '42501';
  end if;

  if new.document_id is distinct from old.document_id then
    new.accepted_at := null;
    new.accepted_by := null;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger case_document_requests_before_update
  before update on public.case_document_requests
  for each row execute function public.case_document_requests_before_update();

-- 3. Envois préparés par le candidat --------------------------------------------

-- Un envoi préparé reçoit son identifiant de document (donc son chemin de
-- stockage). Seul un envoi préparé pour ce dossier peut être confirmé.
create table public.student_document_uploads (
  document_id uuid primary key,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,
  -- Vide si la pièce a été retirée entre-temps
  request_id uuid references public.case_document_requests (id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint student_document_uploads_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id)
);

create index student_document_uploads_case_idx
  on public.student_document_uploads (agency_id, case_id, created_at);
create index student_document_uploads_request_idx
  on public.student_document_uploads (request_id);

alter table public.case_document_requests enable row level security;
alter table public.student_document_uploads enable row level security;

-- Abonnement expiré : lecture seule, comme les autres données de l'agence
create trigger case_document_requests_writable
  before insert or update or delete on public.case_document_requests
  for each row execute function public.enforce_agency_writable();
create trigger student_document_uploads_writable
  before insert or update or delete on public.student_document_uploads
  for each row execute function public.enforce_agency_writable();

-- 4. Fonctions de l'agence (serveur seulement) -----------------------------------

-- Demander une pièce : tout membre actif. Renvoie son identifiant.
create function public.create_document_request(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_label text,
  p_folder_id uuid
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

  -- Verrou du dossier : deux demandes simultanées ne dépassent pas la limite
  perform 1 from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for no key update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  if (select count(*) from public.case_document_requests
      where case_id = p_case_id and agency_id = p_agency_id) >= 30 then
    raise exception 'Trop de pièces demandées' using errcode = '54000';
  end if;

  insert into public.case_document_requests (agency_id, case_id, label, folder_id, created_by)
  values (p_agency_id, p_case_id, p_label, p_folder_id, p_actor_id)
  returning id into v_id;
  return v_id;
end;
$$;

-- Renommer une pièce ou changer son dossier de rangement (pour les
-- prochains envois : le document déjà reçu ne bouge pas). Tout membre actif.
-- Renvoie vrai si quelque chose a changé.
create function public.update_document_request(
  p_request_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_label text,
  p_folder_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_label text;
  v_folder uuid;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  select label, folder_id into v_label, v_folder
  from public.case_document_requests
  where id = p_request_id and case_id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Pièce introuvable' using errcode = 'P0002';
  end if;
  if v_label = p_label and v_folder is not distinct from p_folder_id then
    return false;
  end if;

  update public.case_document_requests
  set label = p_label, folder_id = p_folder_id
  where id = p_request_id;
  return true;
end;
$$;

-- Ne plus demander une pièce : tout membre actif. Le document reçu reste.
create function public.delete_document_request(
  p_request_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  delete from public.case_document_requests
  where id = p_request_id and case_id = p_case_id and agency_id = p_agency_id;
  if not found then
    raise exception 'Pièce introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Accepter (ou ne plus accepter) le document reçu : tout membre actif.
-- p_document_id : le document vu par le membre ; si le candidat l'a
-- remplacé ou retiré entre-temps, rien ne change (55000). Renvoie vrai si
-- l'état a changé.
create function public.set_document_request_accepted(
  p_request_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_document_id uuid,
  p_accepted boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document uuid;
  v_accepted timestamptz;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  select document_id, accepted_at into v_document, v_accepted
  from public.case_document_requests
  where id = p_request_id and case_id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Pièce introuvable' using errcode = 'P0002';
  end if;
  if v_document is distinct from p_document_id then
    raise exception 'Le candidat vient de changer cette pièce' using errcode = '55000';
  end if;
  if (v_accepted is not null) = p_accepted then
    return false;
  end if;

  update public.case_document_requests
  set accepted_at = case when p_accepted then now() end,
      accepted_by = case when p_accepted then p_actor_id end
  where id = p_request_id;
  return true;
end;
$$;

-- 5. Fonctions du candidat (serveur seulement) -----------------------------------

-- Pièce du dossier que le candidat peut encore changer ; verrouillée pour la
-- suite de la transaction. Renvoie son document actuel (vide : en attente).
create function public.lock_student_request(
  p_case_id uuid,
  p_agency_id uuid,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document uuid;
  v_accepted timestamptz;
begin
  select r.document_id, r.accepted_at into v_document, v_accepted
  from public.case_document_requests r
  where r.id = p_request_id and r.case_id = p_case_id and r.agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'Cette pièce n''est plus demandée' using errcode = 'P0002';
  end if;
  if v_accepted is not null
     or exists (select 1 from public.documents d
                where d.id = v_document and d.locked_at is not null) then
    raise exception 'Cette pièce a été acceptée par l''agence' using errcode = '55006';
  end if;
  return v_document;
end;
$$;

-- Prépare l'envoi d'un PDF pour une pièce. Renvoie l'identifiant du futur
-- document et les fichiers des envois de ce dossier jamais confirmés, à
-- supprimer du stockage.
create function public.student_prepare_document(
  p_case_id uuid,
  p_agency_id uuid,
  p_generation integer,
  p_request_id uuid
)
returns table (document_id uuid, stale_paths text[])
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_stale text[];
begin
  perform public.require_student_session(p_case_id, p_agency_id, p_generation);
  perform public.require_writable_agency(p_agency_id);
  perform public.lock_student_request(p_case_id, p_agency_id, p_request_id);

  if (select count(*) from public.student_document_uploads u
      where u.case_id = p_case_id and u.agency_id = p_agency_id
        and u.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Trop d''envois' using errcode = '54000';
  end if;

  with gone as (
    delete from public.student_document_uploads u
    where u.case_id = p_case_id and u.agency_id = p_agency_id
      and u.created_at < now() - interval '1 day'
    returning u.document_id, u.confirmed_at
  )
  select coalesce(
    array_agg(p_agency_id::text || '/' || p_case_id::text || '/' || g.document_id::text || '.pdf')
      filter (where g.confirmed_at is null),
    '{}')
  into v_stale
  from gone g;

  insert into public.student_document_uploads (document_id, agency_id, case_id, request_id)
  values (v_id, p_agency_id, p_case_id, p_request_id);

  return query select v_id, v_stale;
end;
$$;

-- Confirme un envoi préparé, une fois le fichier vérifié par le serveur :
-- crée le document de la pièce et supprime celui qu'il remplace. Renvoie le
-- chemin du fichier remplacé, à supprimer du stockage (vide : aucun).
create function public.student_add_document(
  p_case_id uuid,
  p_agency_id uuid,
  p_generation integer,
  p_document_id uuid,
  p_original_file_name text,
  p_size_bytes bigint
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request uuid;
  v_label text;
  v_folder uuid;
  v_old uuid;
  v_old_path text;
begin
  perform public.require_student_session(p_case_id, p_agency_id, p_generation);
  perform public.require_writable_agency(p_agency_id);

  select u.request_id into v_request
  from public.student_document_uploads u
  where u.document_id = p_document_id
    and u.case_id = p_case_id
    and u.agency_id = p_agency_id
    and u.confirmed_at is null
  for update;

  if not found then
    raise exception 'Envoi introuvable ou expiré' using errcode = '22023';
  end if;
  if v_request is null then
    raise exception 'Cette pièce n''est plus demandée' using errcode = 'P0002';
  end if;

  v_old := public.lock_student_request(p_case_id, p_agency_id, v_request);

  select r.label, r.folder_id into v_label, v_folder
  from public.case_document_requests r
  where r.id = v_request;

  if v_old is not null then
    select d.storage_path into v_old_path
    from public.documents d
    where d.id = v_old and d.agency_id = p_agency_id and d.sent_by_student;
    if not found then
      raise exception 'Ce document n''a pas été envoyé par le candidat' using errcode = '42501';
    end if;
  end if;

  insert into public.documents (id, agency_id, case_id, folder_id, name,
    original_file_name, storage_path, size_bytes, uploaded_by, sent_by_student)
  values (p_document_id, p_agency_id, p_case_id, v_folder, v_label,
    p_original_file_name,
    p_agency_id::text || '/' || p_case_id::text || '/' || p_document_id::text || '.pdf',
    p_size_bytes, null, true);

  update public.student_document_uploads
  set confirmed_at = now()
  where document_id = p_document_id;

  update public.case_document_requests
  set document_id = p_document_id
  where id = v_request;

  if v_old is not null then
    delete from public.documents where id = v_old and agency_id = p_agency_id;
  end if;

  return v_old_path;
end;
$$;

-- Retire le document envoyé pour une pièce : elle repasse en attente.
-- Renvoie le chemin du fichier à supprimer du stockage (vide : rien à
-- retirer).
create function public.student_remove_document(
  p_case_id uuid,
  p_agency_id uuid,
  p_generation integer,
  p_request_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document uuid;
  v_path text;
begin
  perform public.require_student_session(p_case_id, p_agency_id, p_generation);
  perform public.require_writable_agency(p_agency_id);

  v_document := public.lock_student_request(p_case_id, p_agency_id, p_request_id);
  if v_document is null then
    return null;
  end if;

  select d.storage_path into v_path
  from public.documents d
  where d.id = v_document and d.agency_id = p_agency_id and d.sent_by_student;
  if not found then
    raise exception 'Ce document n''a pas été envoyé par le candidat' using errcode = '42501';
  end if;

  delete from public.documents where id = v_document and agency_id = p_agency_id;
  return v_path;
end;
$$;

-- 6. Guide de démarrage : seuls les documents ajoutés par l'agence comptent ------

create or replace function public.onboarding_progress(p_agency_id uuid, p_actor_id uuid)
returns table (
  hidden boolean,
  has_campaign boolean,
  has_case boolean,
  has_document boolean,
  has_student_access boolean,
  has_task boolean,
  has_employee boolean,
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
    (select c.id from public.cases c
     where c.agency_id = p_agency_id
     order by c.created_at desc, c.id
     limit 1)
  from public.agencies a
  where a.id = p_agency_id;
end;
$$;

-- 7. Notifications : pièce envoyée par un candidat ---------------------------------

alter table public.notification_preferences
  -- Pièce envoyée par un candidat (mêmes dossiers que ses messages)
  add column student_documents boolean not null default true;

-- Nouveau choix, facultatif : vide, il garde la valeur enregistrée
drop function public.save_notification_preferences(uuid, uuid, boolean, boolean, boolean, boolean);
create function public.save_notification_preferences(
  p_agency_id uuid,
  p_user_id uuid,
  p_student_messages boolean,
  p_student_reviews boolean,
  p_assigned_tasks boolean,
  p_daily_tasks boolean,
  p_student_documents boolean default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.agency_id = p_agency_id and p.is_active
  ) then
    raise exception 'Membre introuvable' using errcode = '42501';
  end if;

  insert into public.notification_preferences
    (user_id, agency_id, student_messages, student_reviews, assigned_tasks, daily_tasks,
     student_documents)
  values (p_user_id, p_agency_id, coalesce(p_student_messages, true),
    coalesce(p_student_reviews, true), coalesce(p_assigned_tasks, true),
    coalesce(p_daily_tasks, false), coalesce(p_student_documents, true))
  on conflict (user_id) do update set
    student_messages = excluded.student_messages,
    student_reviews = excluded.student_reviews,
    assigned_tasks = excluded.assigned_tasks,
    daily_tasks = excluded.daily_tasks,
    student_documents = coalesce(p_student_documents,
      public.notification_preferences.student_documents),
    updated_at = now();
end;
$$;

-- Même fonction, avec l'événement student_document
create or replace function public.push_targets_case(p_agency_id uuid, p_case_id uuid, p_kind text)
returns table (id uuid, endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind is null
     or p_kind not in ('student_message', 'student_review', 'student_document') then
    raise exception 'Événement inconnu' using errcode = '22023';
  end if;

  return query
  select s.id, s.endpoint, s.p256dh, s.auth
  from public.cases c
  join public.profiles p on p.agency_id = c.agency_id
    and p.is_active and not p.must_change_password
  join public.push_subscriptions s on s.user_id = p.id
  left join public.notification_preferences n on n.user_id = p.id
  left join public.profiles r on r.id = c.assigned_to and r.is_active
  where c.id = p_case_id
    and c.agency_id = p_agency_id
    and (p.id = c.assigned_to or (p.role = 'owner' and r.id is null))
    and case p_kind
      when 'student_message' then coalesce(n.student_messages, true)
      when 'student_review' then coalesce(n.student_reviews, true)
      else coalesce(n.student_documents, true)
    end;
end;
$$;

-- 8. Temps réel : l'agence voit arriver les pièces du candidat ----------------------

alter publication supabase_realtime add table public.case_document_requests;

-- Droits ---------------------------------------------------------------------------

revoke execute on function public.case_document_requests_before_update() from public;
revoke execute on function public.create_document_request(uuid, uuid, uuid, text, uuid) from public;
revoke execute on function public.update_document_request(uuid, uuid, uuid, uuid, text, uuid)
  from public;
revoke execute on function public.delete_document_request(uuid, uuid, uuid, uuid) from public;
revoke execute on function public.set_document_request_accepted(uuid, uuid, uuid, uuid, uuid, boolean)
  from public;
revoke execute on function public.lock_student_request(uuid, uuid, uuid) from public;
revoke execute on function public.student_prepare_document(uuid, uuid, integer, uuid) from public;
revoke execute on function public.student_add_document(uuid, uuid, integer, uuid, text, bigint)
  from public;
revoke execute on function public.student_remove_document(uuid, uuid, integer, uuid) from public;
revoke execute on function public.save_notification_preferences(uuid, uuid, boolean, boolean, boolean, boolean, boolean)
  from public;

grant execute on function public.create_document_request(uuid, uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.update_document_request(uuid, uuid, uuid, uuid, text, uuid)
  to service_role;
grant execute on function public.delete_document_request(uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.set_document_request_accepted(uuid, uuid, uuid, uuid, uuid, boolean)
  to service_role;
grant execute on function public.student_prepare_document(uuid, uuid, integer, uuid)
  to service_role;
grant execute on function public.student_add_document(uuid, uuid, integer, uuid, text, bigint)
  to service_role;
grant execute on function public.student_remove_document(uuid, uuid, integer, uuid)
  to service_role;
grant execute on function public.save_notification_preferences(uuid, uuid, boolean, boolean, boolean, boolean, boolean)
  to service_role;

-- Lecture : l'agence (RLS) et le serveur (espace du candidat). Toute
-- écriture passe par les fonctions.
grant select on public.case_document_requests to authenticated, service_role;
-- Le serveur vérifie qu'un envoi a bien été préparé avant de lire le fichier
grant select on public.student_document_uploads to service_role;

create policy "case_document_requests_select_same_agency" on public.case_document_requests
  for select to authenticated
  using (agency_id = public.current_agency_id());
