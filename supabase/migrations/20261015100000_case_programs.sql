-- Migration : case_programs
-- Formations visées par un candidat, dans l'ordre de préférence : intitulé,
-- niveau, ville et établissement facultatif. 20 au plus par dossier.
-- Lecture : membres actifs de l'agence (RLS).
-- Écriture : tout membre actif, uniquement par les fonctions ci-dessous.

create table public.case_programs (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  case_id uuid not null,

  -- Rang dans la liste, à partir de 1, sans trou
  position integer not null check (position between 1 and 20),

  title text not null check (public.is_clean_text(title, 200)),
  level text not null check (level in (
    'l1', 'l2', 'l3', 'licence_pro', 'm1', 'm2',
    'bts', 'but', 'engineering', 'doctorate', 'other'
  )),
  city text not null check (public.is_clean_text(city, 100)),
  institution text check (institution is null or public.is_clean_text(institution, 150)),

  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Dossier et profils de la même agence. Pas de cascade : un employé qui a
  -- saisi une formation ne peut plus être supprimé.
  constraint case_programs_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_programs_created_by_fk foreign key (created_by, agency_id)
    references public.profiles (id, agency_id),
  constraint case_programs_updated_by_fk foreign key (updated_by, agency_id)
    references public.profiles (id, agency_id),

  -- Vérifiée en fin de transaction : deux formations échangent leur rang
  constraint case_programs_position_unique unique (case_id, position)
    deferrable initially deferred
);

create index case_programs_agency_idx on public.case_programs (agency_id);
create index case_programs_created_by_idx on public.case_programs (created_by);
create index case_programs_updated_by_idx on public.case_programs (updated_by);

alter table public.case_programs enable row level security;

-- Fonctions (serveur seulement) ---------------------------------------------

-- Vérifie l'acteur et verrouille le dossier : les modifications simultanées
-- de la liste se suivent, l'ordre reste sans trou.
create function public.lock_case_programs(
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

  perform 1 from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Ajouter une formation en fin de liste
create function public.create_case_program(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_title text,
  p_level text,
  p_city text,
  p_institution text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_id uuid;
begin
  perform public.lock_case_programs(p_case_id, p_agency_id, p_actor_id);

  select count(*) into v_count
  from public.case_programs
  where case_id = p_case_id and agency_id = p_agency_id;
  if v_count >= 20 then
    raise exception 'Limite de 20 formations par dossier atteinte'
      using errcode = '54000';
  end if;

  insert into public.case_programs (
    agency_id, case_id, position, title, level, city, institution,
    created_by, updated_by
  ) values (
    p_agency_id, p_case_id, v_count + 1, p_title, p_level, p_city, p_institution,
    p_actor_id, p_actor_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Modifier une formation. Renvoie vrai si quelque chose a changé.
create function public.update_case_program(
  p_program_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_title text,
  p_level text,
  p_city text,
  p_institution text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.lock_case_programs(p_case_id, p_agency_id, p_actor_id);

  update public.case_programs
  set title = p_title,
      level = p_level,
      city = p_city,
      institution = p_institution,
      updated_by = p_actor_id,
      updated_at = now()
  where id = p_program_id
    and case_id = p_case_id
    and agency_id = p_agency_id
    and (title, level, city, institution)
        is distinct from (p_title, p_level, p_city, p_institution);
  if found then
    return true;
  end if;

  if not exists (
    select 1 from public.case_programs
    where id = p_program_id and case_id = p_case_id and agency_id = p_agency_id
  ) then
    raise exception 'Formation introuvable' using errcode = 'P0002';
  end if;
  return false;
end;
$$;

-- Supprimer une formation ; les suivantes remontent d'un rang
create function public.delete_case_program(
  p_program_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_position integer;
begin
  perform public.lock_case_programs(p_case_id, p_agency_id, p_actor_id);

  delete from public.case_programs
  where id = p_program_id and case_id = p_case_id and agency_id = p_agency_id
  returning position into v_position;
  if not found then
    raise exception 'Formation introuvable' using errcode = 'P0002';
  end if;

  update public.case_programs
  set position = position - 1
  where case_id = p_case_id and agency_id = p_agency_id and position > v_position;
end;
$$;

-- Monter (-1) ou descendre (+1) une formation d'un rang. Renvoie faux si
-- elle est déjà en tête ou en fin de liste.
create function public.move_case_program(
  p_program_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_direction integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_position integer;
  v_neighbor uuid;
begin
  if p_direction not in (-1, 1) then
    raise exception 'Direction invalide' using errcode = '22023';
  end if;

  perform public.lock_case_programs(p_case_id, p_agency_id, p_actor_id);

  select position into v_position
  from public.case_programs
  where id = p_program_id and case_id = p_case_id and agency_id = p_agency_id;
  if not found then
    raise exception 'Formation introuvable' using errcode = 'P0002';
  end if;

  select id into v_neighbor
  from public.case_programs
  where case_id = p_case_id and agency_id = p_agency_id
    and position = v_position + p_direction;
  if not found then
    return false;
  end if;

  update public.case_programs set position = v_position + p_direction
  where id = p_program_id;
  update public.case_programs set position = v_position
  where id = v_neighbor;
  return true;
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on function public.lock_case_programs(uuid, uuid, uuid) from public;
revoke execute on function public.create_case_program(uuid, uuid, uuid, text, text, text, text)
  from public;
revoke execute on function public.update_case_program(uuid, uuid, uuid, uuid, text, text, text, text)
  from public;
revoke execute on function public.delete_case_program(uuid, uuid, uuid, uuid) from public;
revoke execute on function public.move_case_program(uuid, uuid, uuid, uuid, integer)
  from public;

grant execute on function public.create_case_program(uuid, uuid, uuid, text, text, text, text)
  to service_role;
grant execute on function public.update_case_program(uuid, uuid, uuid, uuid, text, text, text, text)
  to service_role;
grant execute on function public.delete_case_program(uuid, uuid, uuid, uuid)
  to service_role;
grant execute on function public.move_case_program(uuid, uuid, uuid, uuid, integer)
  to service_role;

-- Lecture seule : le serveur écrit seulement par les fonctions ci-dessus
grant select on public.case_programs to authenticated, service_role;

create policy "case_programs_select_same_agency" on public.case_programs
  for select to authenticated
  using (agency_id = public.current_agency_id());
