-- Migration : student_access
-- Accès du candidat à son espace (lecture seule : informations, lettre de
-- motivation, formations) avec un code propre à son dossier.
-- - Le code est créé à la première activation par l'agence (tout membre
--   actif) ; l'accès reste fermé tant qu'il n'est pas activé.
-- - La base ne garde jamais le code en clair : une empreinte HMAC pour la
--   connexion, et une copie chiffrée (AES-GCM, côté serveur) pour l'afficher
--   à l'agence.
-- - `generation` augmente à chaque nouveau code et à chaque désactivation :
--   les sessions ouvertes avec l'ancien état cessent de fonctionner.
-- - Aucun accès direct : ni lecture ni écriture pour les utilisateurs, tout
--   passe par le serveur (clé secrète) et les fonctions ci-dessous.

create table public.case_student_access (
  case_id uuid primary key,
  agency_id uuid not null references public.agencies (id) on delete cascade,

  code_lookup text not null unique check (code_lookup ~ '^[0-9a-f]{64}$'),
  code_encrypted text not null check (length(code_encrypted) between 1 and 500),
  key_version smallint not null default 1 check (key_version > 0),
  generation integer not null default 1 check (generation > 0),
  enabled boolean not null default false,

  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint case_student_access_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id),
  constraint case_student_access_updated_by_fk foreign key (updated_by, agency_id)
    references public.profiles (id, agency_id)
);

create index case_student_access_agency_idx on public.case_student_access (agency_id);
create index case_student_access_updated_by_idx on public.case_student_access (updated_by);

alter table public.case_student_access enable row level security;

-- Échecs de connexion récents, par empreinte d'adresse IP (jamais l'adresse
-- en clair). Sert à limiter les essais ; les lignes de plus d'un jour sont
-- effacées au fil des connexions.
create table public.student_login_failures (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  failed_at timestamptz not null default now()
);

create index student_login_failures_ip_idx
  on public.student_login_failures (ip_hash, failed_at);
create index student_login_failures_failed_at_idx
  on public.student_login_failures (failed_at);

alter table public.student_login_failures enable row level security;

-- Fonctions (serveur seulement) ---------------------------------------------

-- Ouvrir l'accès. À la première activation, le code proposé par le serveur
-- est enregistré ; ensuite le code existant est gardé. Renvoie vrai si
-- l'état a changé.
create function public.enable_student_access(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_code_lookup text,
  p_code_encrypted text,
  p_key_version smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enabled boolean;
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  perform 1 from public.cases
  where id = p_case_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;

  select enabled into v_enabled
  from public.case_student_access
  where case_id = p_case_id and agency_id = p_agency_id;

  if not found then
    insert into public.case_student_access (
      case_id, agency_id, code_lookup, code_encrypted, key_version, enabled, updated_by
    ) values (
      p_case_id, p_agency_id, p_code_lookup, p_code_encrypted, p_key_version, true, p_actor_id
    );
    return true;
  end if;

  if v_enabled then
    return false;
  end if;

  update public.case_student_access
  set enabled = true, updated_by = p_actor_id, updated_at = now()
  where case_id = p_case_id and agency_id = p_agency_id;
  return true;
end;
$$;

-- Fermer l'accès : les sessions ouvertes cessent de fonctionner
create function public.disable_student_access(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  update public.case_student_access
  set enabled = false,
      generation = generation + 1,
      updated_by = p_actor_id,
      updated_at = now()
  where case_id = p_case_id and agency_id = p_agency_id and enabled;
  return found;
end;
$$;

-- Remplacer le code : l'ancien ne fonctionne plus, ni ses sessions
create function public.regenerate_student_code(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_code_lookup text,
  p_code_encrypted text,
  p_key_version smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member(p_actor_id, p_agency_id);

  update public.case_student_access
  set code_lookup = p_code_lookup,
      code_encrypted = p_code_encrypted,
      key_version = p_key_version,
      generation = generation + 1,
      updated_by = p_actor_id,
      updated_at = now()
  where case_id = p_case_id and agency_id = p_agency_id;
  if not found then
    raise exception 'Accès candidat introuvable' using errcode = 'P0002';
  end if;
end;
$$;

-- Conditions d'un accès ouvert : activé, dossier non abandonné, campagne
-- non archivée
create function public.student_access_open(p_case_id uuid, p_agency_id uuid)
returns table (generation integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.generation
  from public.case_student_access a
  join public.cases c on c.id = a.case_id and c.agency_id = a.agency_id
  join public.campaigns k on k.id = c.campaign_id and k.agency_id = c.agency_id
  where a.case_id = p_case_id
    and a.agency_id = p_agency_id
    and a.enabled
    and c.status <> 'abandoned'
    and k.status <> 'archived'
$$;

-- Connexion avec un code : 10 échecs au plus par adresse sur 15 minutes.
-- Renvoie le dossier et sa génération, ou aucune ligne si le code est faux
-- ou l'accès fermé (sans dire lequel).
create function public.student_login(p_code_lookup text, p_ip_hash text)
returns table (case_id uuid, agency_id uuid, generation integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case uuid;
  v_agency uuid;
  v_generation integer;
begin
  delete from public.student_login_failures
  where failed_at < now() - interval '1 day';

  if (select count(*) from public.student_login_failures f
      where f.ip_hash = p_ip_hash
        and f.failed_at > now() - interval '15 minutes') >= 10 then
    raise exception 'Trop de tentatives' using errcode = '54000';
  end if;

  select a.case_id, a.agency_id into v_case, v_agency
  from public.case_student_access a
  where a.code_lookup = p_code_lookup;

  if found then
    select o.generation into v_generation
    from public.student_access_open(v_case, v_agency) o;
  end if;

  if v_generation is null then
    insert into public.student_login_failures (ip_hash) values (p_ip_hash);
    return;
  end if;

  return query select v_case, v_agency, v_generation;
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on function public.enable_student_access(uuid, uuid, uuid, text, text, smallint)
  from public;
revoke execute on function public.disable_student_access(uuid, uuid, uuid) from public;
revoke execute on function public.regenerate_student_code(uuid, uuid, uuid, text, text, smallint)
  from public;
revoke execute on function public.student_access_open(uuid, uuid) from public;
revoke execute on function public.student_login(text, text) from public;

grant execute on function public.enable_student_access(uuid, uuid, uuid, text, text, smallint)
  to service_role;
grant execute on function public.disable_student_access(uuid, uuid, uuid) to service_role;
grant execute on function public.regenerate_student_code(uuid, uuid, uuid, text, text, smallint)
  to service_role;
grant execute on function public.student_access_open(uuid, uuid) to service_role;
grant execute on function public.student_login(text, text) to service_role;

-- Lecture par le serveur seulement (afficher le code à l'agence)
grant select on public.case_student_access to service_role;
