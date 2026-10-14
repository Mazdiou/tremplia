-- Migration : case_messages (conversation)
-- Conversation entre le candidat et l'agence, une par dossier, dans la table
-- case_messages (migration student_review).
-- - L'agence écrit : tout membre actif ; le candidat : depuis son espace,
--   avec une session valable. 30 messages par heure au plus pour le
--   candidat.
-- - Lu / non lu : une date de dernière lecture par côté. Côté agence, elle
--   est partagée par l'équipe : un message lu par un membre est lu pour tous.

create table public.case_message_reads (
  case_id uuid primary key,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  agency_read_at timestamptz,
  student_read_at timestamptz,

  constraint case_message_reads_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id)
);

create index case_message_reads_agency_idx on public.case_message_reads (agency_id);

alter table public.case_message_reads enable row level security;

-- Lecture par le serveur seulement
grant select on public.case_message_reads to service_role;

-- Date de lecture d'un côté ('agency' ou 'student'). Heure réelle
-- (clock_timestamp) pour messages et lectures : leur ordre reste strict,
-- même dans une seule transaction.
create function public.touch_message_read(p_case_id uuid, p_agency_id uuid, p_side text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.case_message_reads (case_id, agency_id, agency_read_at, student_read_at)
  values (
    p_case_id, p_agency_id,
    case when p_side = 'agency' then clock_timestamp() end,
    case when p_side = 'student' then clock_timestamp() end
  )
  on conflict (case_id) do update
  set agency_read_at = case when p_side = 'agency' then clock_timestamp()
                            else public.case_message_reads.agency_read_at end,
      student_read_at = case when p_side = 'student' then clock_timestamp()
                             else public.case_message_reads.student_read_at end;
end;
$$;

-- Vérifie la session du candidat (accès ouvert, même génération)
create function public.require_student_session(
  p_case_id uuid,
  p_agency_id uuid,
  p_generation integer
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.student_access_open(p_case_id, p_agency_id) o
    where o.generation = p_generation
  ) then
    raise exception 'Accès fermé' using errcode = '42501';
  end if;
end;
$$;

-- Message d'un membre de l'agence. L'auteur a lu toute la conversation.
create function public.send_agency_message(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_body text
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

  if not exists (
    select 1 from public.cases where id = p_case_id and agency_id = p_agency_id
  ) then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  insert into public.case_messages (agency_id, case_id, sender, author_id, body, created_at)
  values (p_agency_id, p_case_id, 'agency', p_actor_id, p_body, clock_timestamp())
  returning id into v_id;

  perform public.touch_message_read(p_case_id, p_agency_id, 'agency');
  return v_id;
end;
$$;

-- Message du candidat, depuis son espace
create function public.send_student_message(
  p_case_id uuid,
  p_agency_id uuid,
  p_generation integer,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.require_student_session(p_case_id, p_agency_id, p_generation);

  if (select count(*) from public.case_messages
      where case_id = p_case_id and agency_id = p_agency_id
        and sender = 'student' and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop de messages' using errcode = '54000';
  end if;

  insert into public.case_messages (agency_id, case_id, sender, body, created_at)
  values (p_agency_id, p_case_id, 'student', p_body, clock_timestamp())
  returning id into v_id;

  perform public.touch_message_read(p_case_id, p_agency_id, 'student');
  return v_id;
end;
$$;

-- Conversation ouverte : marquée lue pour ce côté
create function public.mark_messages_read_agency(
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
  if exists (select 1 from public.cases where id = p_case_id and agency_id = p_agency_id) then
    perform public.touch_message_read(p_case_id, p_agency_id, 'agency');
  end if;
end;
$$;

create function public.mark_messages_read_student(
  p_case_id uuid,
  p_agency_id uuid,
  p_generation integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_student_session(p_case_id, p_agency_id, p_generation);
  perform public.touch_message_read(p_case_id, p_agency_id, 'student');
end;
$$;

-- Messages du candidat non lus par l'agence, par dossier
create function public.agency_unread_messages(p_agency_id uuid)
returns table (case_id uuid, unread bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.case_id, count(*)
  from public.case_messages m
  left join public.case_message_reads r on r.case_id = m.case_id
  where m.agency_id = p_agency_id
    and m.sender = 'student'
    and (r.agency_read_at is null or m.created_at > r.agency_read_at)
  group by m.case_id
$$;

-- Messages de l'agence non lus par le candidat
create function public.student_unread_messages(p_case_id uuid, p_agency_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.case_messages m
  left join public.case_message_reads r on r.case_id = m.case_id
  where m.case_id = p_case_id
    and m.agency_id = p_agency_id
    and m.sender = 'agency'
    and (r.student_read_at is null or m.created_at > r.student_read_at)
$$;

-- Droits --------------------------------------------------------------------

revoke execute on function public.touch_message_read(uuid, uuid, text) from public;
revoke execute on function public.require_student_session(uuid, uuid, integer) from public;
revoke execute on function public.send_agency_message(uuid, uuid, uuid, text) from public;
revoke execute on function public.send_student_message(uuid, uuid, integer, text) from public;
revoke execute on function public.mark_messages_read_agency(uuid, uuid, uuid) from public;
revoke execute on function public.mark_messages_read_student(uuid, uuid, integer) from public;
revoke execute on function public.agency_unread_messages(uuid) from public;
revoke execute on function public.student_unread_messages(uuid, uuid) from public;

grant execute on function public.send_agency_message(uuid, uuid, uuid, text) to service_role;
grant execute on function public.send_student_message(uuid, uuid, integer, text) to service_role;
grant execute on function public.mark_messages_read_agency(uuid, uuid, uuid) to service_role;
grant execute on function public.mark_messages_read_student(uuid, uuid, integer) to service_role;
grant execute on function public.agency_unread_messages(uuid) to service_role;
grant execute on function public.student_unread_messages(uuid, uuid) to service_role;
