-- Migration : student_review
-- Validation par le candidat de sa lettre de motivation et de ses
-- formations, depuis son espace : « Je valide » ou « Demander une
-- modification » (avec un message).
-- - L'état est gardé par dossier (pas de ligne = en attente de réponse).
-- - Toute modification de la lettre ou des formations par l'agence remet
--   l'état « en attente » : le candidat valide toujours la dernière version.
-- - Les messages du candidat (et plus tard de l'agence) vont dans
--   case_messages, la conversation du dossier.

-- 1. Conversation du dossier ------------------------------------------------

create table public.case_messages (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,

  -- Le candidat (sans compte) ou un membre de l'agence (author_id)
  sender text not null check (sender in ('student', 'agency')),
  author_id uuid,
  -- Demande de modification ou simple message
  kind text not null default 'message' check (kind in ('message', 'change_request')),
  body text not null check (body ~ '\S' and length(body) <= 2000),
  created_at timestamptz not null default now(),

  constraint case_messages_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_messages_author_fk foreign key (author_id, agency_id)
    references public.profiles (id, agency_id),
  constraint case_messages_author_consistent
    check ((sender = 'agency') = (author_id is not null))
);

create index case_messages_case_idx
  on public.case_messages (agency_id, case_id, created_at);
create index case_messages_author_idx on public.case_messages (author_id);

alter table public.case_messages enable row level security;

grant select on public.case_messages to authenticated, service_role;

create policy "case_messages_select_same_agency" on public.case_messages
  for select to authenticated
  using (agency_id = public.current_agency_id());

-- 2. Réponse du candidat ----------------------------------------------------

create table public.case_student_reviews (
  case_id uuid primary key,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'changes_requested')),
  -- Dernière réponse du candidat (validation ou demande)
  responded_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint case_student_reviews_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_student_reviews_responded
    check (status = 'pending' or responded_at is not null)
);

create index case_student_reviews_agency_idx on public.case_student_reviews (agency_id);

alter table public.case_student_reviews enable row level security;

grant select on public.case_student_reviews to authenticated, service_role;

create policy "case_student_reviews_select_same_agency" on public.case_student_reviews
  for select to authenticated
  using (agency_id = public.current_agency_id());

-- Réponse du candidat, depuis son espace. Revérifie que sa session est
-- toujours valable (accès ouvert, même génération). Renvoie vrai si l'état
-- a changé ; une demande de modification est toujours enregistrée.
create function public.student_review(
  p_case_id uuid,
  p_agency_id uuid,
  p_generation integer,
  p_decision text,
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'Réponse invalide' using errcode = '22023';
  end if;

  -- Verrouille le dossier : une réponse et une modification de l'agence
  -- simultanées se suivent
  perform 1 from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;

  if not exists (
    select 1 from public.student_access_open(p_case_id, p_agency_id) o
    where o.generation = p_generation
  ) then
    raise exception 'Accès fermé' using errcode = '42501';
  end if;

  -- Rien à valider tant que l'agence n'a écrit ni lettre ni formation
  if not exists (
       select 1 from public.case_motivation_letters
       where case_id = p_case_id and agency_id = p_agency_id and content ~ '\S')
     and not exists (
       select 1 from public.case_programs
       where case_id = p_case_id and agency_id = p_agency_id) then
    raise exception 'Rien à valider' using errcode = '22023';
  end if;

  if p_decision = 'changes_requested' then
    insert into public.case_messages (agency_id, case_id, sender, kind, body)
    values (p_agency_id, p_case_id, 'student', 'change_request', p_message);
  end if;

  select status into v_old
  from public.case_student_reviews
  where case_id = p_case_id and agency_id = p_agency_id;

  insert into public.case_student_reviews (case_id, agency_id, status, responded_at)
  values (p_case_id, p_agency_id, p_decision, now())
  on conflict (case_id) do update
  set status = excluded.status,
      responded_at = excluded.responded_at,
      updated_at = now();

  return v_old is distinct from p_decision or p_decision = 'changes_requested';
end;
$$;

-- 3. Retour « en attente » quand l'agence modifie le contenu ----------------

create function public.reset_student_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case uuid;
  v_agency uuid;
begin
  if tg_op = 'DELETE' then
    v_case := old.case_id;
    v_agency := old.agency_id;
  else
    v_case := new.case_id;
    v_agency := new.agency_id;
  end if;

  update public.case_student_reviews
  set status = 'pending', updated_at = now()
  where case_id = v_case and agency_id = v_agency and status <> 'pending';
  return null;
end;
$$;

create trigger case_motivation_letters_reset_review
  after insert or update of content on public.case_motivation_letters
  for each row execute function public.reset_student_review();

-- Les changements de rang comptent aussi : l'ordre de préférence fait
-- partie de ce que le candidat valide
create trigger case_programs_reset_review
  after insert or update or delete on public.case_programs
  for each row execute function public.reset_student_review();

-- Droits --------------------------------------------------------------------

revoke execute on function public.student_review(uuid, uuid, integer, text, text) from public;
revoke execute on function public.reset_student_review() from public;

grant execute on function public.student_review(uuid, uuid, integer, text, text)
  to service_role;
