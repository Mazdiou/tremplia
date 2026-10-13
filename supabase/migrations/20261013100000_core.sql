-- Migration : core
-- Socle : droits par défaut, agences, profils, fonctions d'aide.
--
-- Règles du projet, valables pour toutes les migrations :
-- - le navigateur (authenticated) LIT via le RLS, il n'écrit jamais ;
-- - le serveur (service_role, clé secrète) écrit, et seulement ce qui lui
--   est accordé table par table : dès qu'une règle dépend de l'acteur ou de
--   son rôle, l'écriture passe par une fonction SQL qui reçoit l'acteur et
--   le vérifie ici, dans la base ;
-- - anon n'a aucun droit.

-- Droits par défaut : rien n'est exposé automatiquement, pas même au
-- serveur (Supabase lui accorde sinon tous les droits sur chaque table).
alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges in schema public revoke execute on functions from anon, authenticated, service_role;
-- PostgreSQL accorde en plus l'exécution de toute nouvelle fonction à PUBLIC,
-- ce qu'un droit par défaut limité au schéma ne peut pas retirer : chaque
-- migration le retire donc elle-même (« revoke … from public », section Droits).

-- Texte « propre » : sans espace avant ni après, entre 1 et p_max caractères.
-- Une valeur vide (null) est acceptée : la colonne dit si elle est obligatoire.
create function public.is_clean_text(p_value text, p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_value = btrim(p_value) and length(p_value) between 1 and p_max
$$;

-- Tables --------------------------------------------------------------------

create table public.agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (public.is_clean_text(name, 100)),
  city text not null check (public.is_clean_text(city, 100)),
  phone text not null check (public.is_clean_text(phone, 30)),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  agency_id uuid not null references public.agencies (id) on delete cascade,
  first_name text not null check (public.is_clean_text(first_name, 100)),
  last_name text not null check (public.is_clean_text(last_name, 100)),
  role text not null check (role in ('owner', 'employee')),
  is_active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),

  -- Cible des liens composites (profil, agence) des autres tables : un
  -- auteur ou un responsable est toujours de la même agence que sa ligne.
  constraint profiles_id_agency_unique unique (id, agency_id)
);

create index profiles_agency_id_idx on public.profiles (agency_id);

-- Un profil n'est supprimé (avec son compte Auth) que s'il s'agit d'un
-- employé déjà désactivé. S'il a créé quoi que ce soit, les clés étrangères
-- des autres tables refusent aussi : il reste alors désactivé.
create function public.profiles_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role <> 'employee' or old.is_active then
    raise exception 'Seul un employé désactivé peut être supprimé'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger profiles_before_delete
  before delete on public.profiles
  for each row execute function public.profiles_before_delete();

alter table public.agencies enable row level security;
alter table public.profiles enable row level security;

-- Fonctions d'aide (security definer : évite la récursion RLS) --------------

create function public.current_agency_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select agency_id from public.profiles
  where id = (select auth.uid()) and is_active
$$;

create function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'owner' from public.profiles
     where id = (select auth.uid()) and is_active),
    false
  )
$$;

-- Contrôle de l'acteur, utilisé par toutes les fonctions d'écriture :
-- renvoie son rôle s'il est un membre ACTIF de l'agence, sinon refuse.
create function public.require_active_member(p_actor_id uuid, p_agency_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.profiles
  where id = p_actor_id and agency_id = p_agency_id and is_active;

  if v_role is null then
    raise exception 'Utilisateur invalide' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

create function public.require_owner(p_actor_id uuid, p_agency_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.require_active_member(p_actor_id, p_agency_id) <> 'owner' then
    raise exception 'Action réservée au patron' using errcode = '42501';
  end if;
end;
$$;

-- Écritures (serveur seulement) ---------------------------------------------

-- Création d'une agence et de son premier patron (une seule transaction).
create function public.create_agency_with_owner(
  p_user_id uuid,
  p_agency_name text,
  p_city text,
  p_phone text,
  p_first_name text,
  p_last_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agency_id uuid;
begin
  insert into public.agencies (name, city, phone)
  values (p_agency_name, p_city, p_phone)
  returning id into v_agency_id;

  insert into public.profiles (id, agency_id, first_name, last_name, role)
  values (p_user_id, v_agency_id, p_first_name, p_last_name, 'owner');

  return v_agency_id;
end;
$$;

-- Ajout d'un employé (patron seulement). Le compte Auth est créé juste
-- avant par la route ; il doit changer son mot de passe temporaire.
create function public.add_employee(
  p_agency_id uuid,
  p_actor_id uuid,
  p_user_id uuid,
  p_first_name text,
  p_last_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  insert into public.profiles (
    id, agency_id, first_name, last_name, role, must_change_password
  ) values (
    p_user_id, p_agency_id, p_first_name, p_last_name, 'employee', true
  );
end;
$$;

-- Désactiver / réactiver un employé (patron seulement, jamais soi-même ni
-- un patron : l'agence garde donc toujours un patron actif).
-- Renvoie vrai si le statut a changé.
create function public.set_employee_active(
  p_agency_id uuid,
  p_actor_id uuid,
  p_employee_id uuid,
  p_active boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  if p_employee_id = p_actor_id then
    raise exception 'Vous ne pouvez pas modifier votre propre statut'
      using errcode = '42501';
  end if;

  select role into v_role
  from public.profiles
  where id = p_employee_id and agency_id = p_agency_id
  for update;

  if not found then
    raise exception 'Employé introuvable' using errcode = 'P0002';
  end if;
  if v_role <> 'employee' then
    raise exception 'Seul un compte employé peut être désactivé'
      using errcode = '42501';
  end if;

  update public.profiles
  set is_active = p_active
  where id = p_employee_id and agency_id = p_agency_id
    and is_active <> p_active;

  return found;
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on all functions in schema public from public;

grant execute on function public.is_clean_text(text, integer) to service_role;
grant execute on function public.current_agency_id() to authenticated;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.create_agency_with_owner(uuid, text, text, text, text, text)
  to service_role;
grant execute on function public.add_employee(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.set_employee_active(uuid, uuid, uuid, boolean)
  to service_role;

grant select on public.agencies to authenticated, service_role;
grant select on public.profiles to authenticated, service_role;
-- Seule écriture directe du serveur : fin du mot de passe temporaire.
-- La suppression d'un profil passe par celle du compte Auth (cascade).
grant update (must_change_password) on public.profiles to service_role;

create policy "agencies_select_own" on public.agencies
  for select to authenticated
  using (id = public.current_agency_id());

create policy "profiles_select_same_agency" on public.profiles
  for select to authenticated
  using (agency_id = public.current_agency_id());
