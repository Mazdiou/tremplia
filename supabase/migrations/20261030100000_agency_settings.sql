-- Migration : agency_settings
-- Page Réglages :
-- - le patron modifie le profil de l'agence (nom, ville, téléphone), saisi
--   jusqu'ici une seule fois à l'inscription ;
-- - il choisit les valeurs proposées à chaque nouvelle campagne (tarif,
--   plateformes, étapes), modifiables ensuite campagne par campagne ;
-- - chaque membre corrige son prénom et son nom ;
-- - chaque membre change son mot de passe en donnant l'actuel, avec un
--   nombre d'essais limité (une session volée ne doit pas permettre de le
--   deviner).
-- Toutes ces écritures sont refusées quand l'abonnement est terminé.

-- 1. Valeurs par défaut des nouvelles campagnes -------------------------------

-- Étapes : 15 au plus, chacune « propre » et de 60 caractères au plus, sans
-- doublon (majuscules ignorées). Mêmes règles que create_campaign.
create function public.is_valid_stage_list(p_stages text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select cardinality(p_stages) <= 15
    and coalesce(
      (select bool_and(coalesce(public.is_clean_text(s, 60), false))
       from unnest(p_stages) as s),
      true)
    and (select count(distinct lower(s)) from unnest(p_stages) as s)
        = cardinality(p_stages)
$$;

alter table public.agencies
  add column default_fee integer check (public.is_valid_amount(default_fee)),
  add column default_platforms text[] not null default '{}'
    check (public.is_valid_platform_list(default_platforms)),
  -- null : la liste par défaut de l'application ; '{}' : aucune étape
  add column default_stages text[]
    check (default_stages is null or public.is_valid_stage_list(default_stages));

-- 2. Profil de l'agence (patron seulement) ------------------------------------

create function public.update_agency_profile(
  p_agency_id uuid,
  p_actor_id uuid,
  p_name text,
  p_city text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);
  perform public.require_writable_agency(p_agency_id);

  update public.agencies
  set name = p_name, city = p_city, phone = p_phone
  where id = p_agency_id;
end;
$$;

create function public.update_agency_defaults(
  p_agency_id uuid,
  p_actor_id uuid,
  p_default_fee integer,
  p_default_platforms text[],
  p_default_stages text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_owner(p_actor_id, p_agency_id);
  perform public.require_writable_agency(p_agency_id);

  update public.agencies
  set default_fee = p_default_fee,
      default_platforms = coalesce(p_default_platforms, '{}'),
      default_stages = p_default_stages
  where id = p_agency_id;
end;
$$;

-- 3. Nom d'un membre (lui-même seulement) -------------------------------------
-- Le déclencheur profiles_writable refuse le changement en lecture seule.

create function public.update_own_name(
  p_agency_id uuid,
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
  perform public.require_active_member(p_user_id, p_agency_id);

  update public.profiles
  set first_name = p_first_name, last_name = p_last_name
  where id = p_user_id and agency_id = p_agency_id;
end;
$$;

-- 4. Changement de mot de passe : essais limités -------------------------------
-- 5 mauvais mots de passe actuels par compte sur 15 minutes. Le serveur
-- vérifie la limite AVANT de tester le mot de passe, et note chaque échec.

create table public.password_check_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  failed_at timestamptz not null default now()
);

create index password_check_failures_user_idx
  on public.password_check_failures (user_id, failed_at);
create index password_check_failures_failed_at_idx
  on public.password_check_failures (failed_at);

-- Aucune politique : seul le serveur y accède, par les fonctions ci-dessous
alter table public.password_check_failures enable row level security;

create function public.password_check_allowed(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.password_check_failures
  where failed_at < now() - interval '1 day';

  if (select count(*) from public.password_check_failures f
      where f.user_id = p_user_id
        and f.failed_at > now() - interval '15 minutes') >= 5 then
    raise exception 'Trop de tentatives' using errcode = '54000';
  end if;
end;
$$;

create function public.password_check_failed(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.password_check_failures (user_id) values (p_user_id);
$$;

-- Droits ----------------------------------------------------------------------

revoke execute on function public.is_valid_stage_list(text[]) from public;
revoke execute on function public.update_agency_profile(uuid, uuid, text, text, text) from public;
revoke execute on function public.update_agency_defaults(uuid, uuid, integer, text[], text[])
  from public;
revoke execute on function public.update_own_name(uuid, uuid, text, text) from public;
revoke execute on function public.password_check_allowed(uuid) from public;
revoke execute on function public.password_check_failed(uuid) from public;

grant execute on function public.is_valid_stage_list(text[]) to service_role;
grant execute on function public.update_agency_profile(uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.update_agency_defaults(uuid, uuid, integer, text[], text[])
  to service_role;
grant execute on function public.update_own_name(uuid, uuid, text, text) to service_role;
grant execute on function public.password_check_allowed(uuid) to service_role;
grant execute on function public.password_check_failed(uuid) to service_role;
