-- Migration : rate_limits
-- Limites d'essais qui ne dépendent pas seulement de l'adresse IP du
-- visiteur (qu'un hébergeur mal réglé laisse falsifier) :
-- 1. connexion des candidats : en plus des 10 échecs par adresse sur
--    15 minutes, 200 échecs au plus sur 15 minutes pour tout le service ;
-- 2. inscription d'une agence : 3 essais par adresse et 30 en tout par heure.
-- Les adresses ne sont jamais gardées en clair (empreinte HMAC du serveur).

-- 1. Connexion des candidats ------------------------------------------------

-- Le code fait 8 caractères (environ mille milliards de possibilités) : la
-- limite globale rend toute recherche au hasard vaine, même avec une
-- adresse différente à chaque essai. Pendant une attaque, les vrais
-- candidats peuvent attendre quelques minutes : c'est le prix à payer.
create or replace function public.student_login(p_code_lookup text, p_ip_hash text)
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
        and f.failed_at > now() - interval '15 minutes') >= 10
     or (select count(*) from public.student_login_failures f
         where f.failed_at > now() - interval '15 minutes') >= 200 then
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

-- 2. Inscription d'une agence -----------------------------------------------

create table public.registration_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  attempted_at timestamptz not null default now()
);

create index registration_attempts_ip_idx
  on public.registration_attempts (ip_hash, attempted_at);
create index registration_attempts_attempted_at_idx
  on public.registration_attempts (attempted_at);

-- Aucune politique : seul le serveur y accède, par la fonction ci-dessous
alter table public.registration_attempts enable row level security;

-- Compte un essai d'inscription, ou le refuse si la limite est atteinte.
-- Appelée avant la création du compte : un essai refusé plus loin (e-mail
-- déjà utilisé…) compte aussi, ce qui empêche de sonder les adresses.
create function public.register_attempt(p_ip_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.registration_attempts
  where attempted_at < now() - interval '1 day';

  if (select count(*) from public.registration_attempts r
      where r.ip_hash = p_ip_hash
        and r.attempted_at > now() - interval '1 hour') >= 3
     or (select count(*) from public.registration_attempts r
         where r.attempted_at > now() - interval '1 hour') >= 30 then
    raise exception 'Trop d''inscriptions' using errcode = '54000';
  end if;

  insert into public.registration_attempts (ip_hash) values (p_ip_hash);
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on function public.register_attempt(text) from public;
grant execute on function public.register_attempt(text) to service_role;
