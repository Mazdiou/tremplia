-- Migration : emails
-- E-mails envoyés par l'application (Resend) :
-- 1. demandes d'e-mail venues de pages publiques (mot de passe oublié,
--    nouvel e-mail de confirmation) : limitées par adresse IP, par adresse
--    e-mail et pour tout le service, sans garder ni l'une ni l'autre en clair ;
-- 2. compte lié à une adresse e-mail, lu avant d'envoyer quoi que ce soit ;
-- 3. rappels de fin d'essai ou d'abonnement (7 jours et 1 jour avant), un
--    seul par échéance.

-- 1. Demandes d'e-mail --------------------------------------------------------

create table public.email_requests (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('recovery', 'confirmation')),
  ip_hash text not null check (ip_hash ~ '^[0-9a-f]{64}$'),
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  requested_at timestamptz not null default now()
);

create index email_requests_ip_idx on public.email_requests (ip_hash, requested_at);
create index email_requests_email_idx on public.email_requests (email_hash, kind, requested_at);
create index email_requests_requested_at_idx on public.email_requests (requested_at);

-- Aucune politique : seul le serveur y accède, par la fonction ci-dessous
alter table public.email_requests enable row level security;

-- Compte une demande. Refusée (54000) au-delà de 5 par heure depuis une
-- même adresse IP ou de 50 par heure pour tout le service (le forfait
-- gratuit de Resend est de 100 e-mails par jour). Renvoie false, sans
-- erreur, au-delà de 3 par heure pour une même adresse e-mail : la page
-- répond comme d'habitude, rien n'est envoyé (ni boîte inondée, ni
-- indice sur l'existence du compte).
create function public.email_request_allowed(p_kind text, p_ip_hash text, p_email_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_same_email integer;
begin
  delete from public.email_requests
  where requested_at < now() - interval '1 day';

  if (select count(*) from public.email_requests r
      where r.ip_hash = p_ip_hash
        and r.requested_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.email_requests r
         where r.requested_at > now() - interval '1 hour') >= 50 then
    raise exception 'Trop de demandes' using errcode = '54000';
  end if;

  select count(*) into v_same_email
  from public.email_requests r
  where r.email_hash = p_email_hash
    and r.kind = p_kind
    and r.requested_at > now() - interval '1 hour';

  insert into public.email_requests (kind, ip_hash, email_hash)
  values (p_kind, p_ip_hash, p_email_hash);

  return v_same_email < 3;
end;
$$;

-- 2. Compte lié à une adresse e-mail ------------------------------------------

-- Aucune ligne si l'adresse est inconnue. « active » : profil actif et
-- compte non suspendu (un employé désactivé ne reçoit rien).
create function public.account_for_email(p_email text)
returns table (user_id uuid, first_name text, confirmed boolean, active boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
    p.first_name,
    u.email_confirmed_at is not null,
    coalesce(p.is_active, false) and (u.banned_until is null or u.banned_until <= now())
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(p_email))
  limit 1
$$;

-- 3. Rappels de fin d'essai ou d'abonnement -----------------------------------

create table public.subscription_reminders (
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- Échéance rappelée : un renouvellement la change, les rappels repartent
  ends_at timestamptz not null,
  kind text not null check (kind in ('j7', 'j1')),
  sent_at timestamptz not null default now(),
  primary key (agency_id, ends_at, kind)
);

alter table public.subscription_reminders enable row level security;

-- Rappels à envoyer maintenant, un par patron actif à l'adresse confirmée :
-- - j1 : l'échéance tombe dans les prochaines 24 heures ;
-- - j7 : dans les 7 prochains jours, sauf pour une agence inscrite depuis
--   moins de 2 jours (son essai vient de commencer) et si le rappel j1 est
--   déjà parti.
-- Ni l'agence de l'administrateur (exempt), ni une agence déjà expirée.
create function public.due_subscription_reminders()
returns table (
  agency_id uuid,
  agency_name text,
  ends_at timestamptz,
  state text,
  kind text,
  email text,
  first_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with due as (
    select a.id, a.name, a.created_at, s.ends_at, s.state,
      case when s.ends_at <= now() + interval '1 day' then 'j1' else 'j7' end as kind
    from public.agencies a
    cross join lateral public.agency_subscription(a.id) s
    where s.state in ('trial', 'active')
      and s.ends_at > now()
      and s.ends_at <= now() + interval '7 days'
  )
  select d.id, d.name, d.ends_at, d.state, d.kind, u.email::text, p.first_name
  from due d
  join public.profiles p on p.agency_id = d.id and p.role = 'owner' and p.is_active
  join auth.users u on u.id = p.id
  where u.email is not null
    and u.email_confirmed_at is not null
    and (d.kind = 'j1' or d.created_at <= now() - interval '2 days')
    and not exists (
      select 1 from public.subscription_reminders r
      where r.agency_id = d.id and r.ends_at = d.ends_at
        and (r.kind = d.kind or r.kind = 'j1')
    )
  order by d.ends_at
$$;

-- Réserve un rappel avant de l'envoyer : true si personne ne l'a fait (deux
-- lancements simultanés n'envoient pas deux fois le même)
create function public.claim_subscription_reminder(p_agency_id uuid, p_ends_at timestamptz, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscription_reminders (agency_id, ends_at, kind)
  values (p_agency_id, p_ends_at, p_kind)
  on conflict do nothing;
  return found;
end;
$$;

-- Envoi échoué : le rappel est libéré pour le prochain lancement
create function public.release_subscription_reminder(p_agency_id uuid, p_ends_at timestamptz, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.subscription_reminders
  where agency_id = p_agency_id and ends_at = p_ends_at and kind = p_kind
$$;

-- Droits --------------------------------------------------------------------

revoke execute on function public.email_request_allowed(text, text, text) from public;
revoke execute on function public.account_for_email(text) from public;
revoke execute on function public.due_subscription_reminders() from public;
revoke execute on function public.claim_subscription_reminder(uuid, timestamptz, text) from public;
revoke execute on function public.release_subscription_reminder(uuid, timestamptz, text) from public;

grant execute on function public.email_request_allowed(text, text, text) to service_role;
grant execute on function public.account_for_email(text) to service_role;
grant execute on function public.due_subscription_reminders() to service_role;
grant execute on function public.claim_subscription_reminder(uuid, timestamptz, text) to service_role;
grant execute on function public.release_subscription_reminder(uuid, timestamptz, text) to service_role;
