-- Migration : push_notifications
-- Notifications sur le téléphone ou l'ordinateur (Web Push), même quand
-- Tremplia est fermé :
-- 1. appareils abonnés : ceux d'un membre de l'agence, ou ceux du candidat
--    d'un dossier (valables tant que son accès reste le même) ;
-- 2. choix de chaque membre (ce qu'il veut recevoir) ;
-- 3. destinataires de chaque événement, lus par le serveur au moment
--    d'envoyer ;
-- 4. récapitulatif du matin (tâches du jour), un seul par jour.
-- Seul le serveur y accède (clé secrète) : aucune politique, aucun droit
-- pour le navigateur.

-- 1. Appareils abonnés ----------------------------------------------------------

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- Un membre de l'agence…
  user_id uuid,
  -- … ou le candidat d'un dossier, pour l'accès en cours (generation)
  case_id uuid,
  student_generation integer,

  -- Adresse donnée par le navigateur (service de Google, Apple, Mozilla…)
  -- et clés de chiffrement du contenu : un appareil n'a qu'une adresse
  endpoint text not null unique
    check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_=-]{20,200}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_=-]{8,100}$'),
  created_at timestamptz not null default now(),

  constraint push_subscriptions_owner check (
    (user_id is not null and case_id is null and student_generation is null)
    or (user_id is null and case_id is not null and student_generation is not null)
  ),
  -- Membre ou dossier de la même agence ; supprimés avec eux
  constraint push_subscriptions_user_fk foreign key (user_id, agency_id)
    references public.profiles (id, agency_id) on delete cascade,
  constraint push_subscriptions_case_fk foreign key (case_id, agency_id)
    references public.cases (id, agency_id) on delete cascade
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);
create index push_subscriptions_case_idx on public.push_subscriptions (case_id);

alter table public.push_subscriptions enable row level security;

-- 2. Choix de chaque membre -----------------------------------------------------

-- Sans ligne : les valeurs par défaut ci-dessous
create table public.notification_preferences (
  user_id uuid primary key,
  agency_id uuid not null,
  -- Messages des candidats (dossiers dont il est responsable ; patron :
  -- aussi ceux sans responsable actif)
  student_messages boolean not null default true,
  -- Réponse d'un candidat sur sa lettre et ses formations (mêmes dossiers)
  student_reviews boolean not null default true,
  -- Tâche confiée par un collègue
  assigned_tasks boolean not null default true,
  -- Récapitulatif du matin (tâches du jour et en retard)
  daily_tasks boolean not null default false,
  -- Jour du dernier récapitulatif envoyé : un seul par jour
  daily_sent_on date,
  updated_at timestamptz not null default now(),
  constraint notification_preferences_user_fk foreign key (user_id, agency_id)
    references public.profiles (id, agency_id) on delete cascade
);

alter table public.notification_preferences enable row level security;

-- Choix d'un membre actif, pour lui-même
create function public.save_notification_preferences(
  p_agency_id uuid,
  p_user_id uuid,
  p_student_messages boolean,
  p_student_reviews boolean,
  p_assigned_tasks boolean,
  p_daily_tasks boolean
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
    (user_id, agency_id, student_messages, student_reviews, assigned_tasks, daily_tasks)
  values (p_user_id, p_agency_id, coalesce(p_student_messages, true),
    coalesce(p_student_reviews, true), coalesce(p_assigned_tasks, true),
    coalesce(p_daily_tasks, false))
  on conflict (user_id) do update set
    student_messages = excluded.student_messages,
    student_reviews = excluded.student_reviews,
    assigned_tasks = excluded.assigned_tasks,
    daily_tasks = excluded.daily_tasks,
    updated_at = now();
end;
$$;

-- Enregistre l'appareil d'un membre actif (p_user_id) ou du candidat d'un
-- dossier à l'accès ouvert (p_case_id, p_generation). Un appareil déjà
-- connu change de propriétaire (appareil partagé : le dernier qui active les
-- notifications les reçoit). Au plus 10 appareils par membre et 5 par
-- candidat : les plus anciens sont retirés.
create function public.save_push_subscription(
  p_agency_id uuid,
  p_user_id uuid,
  p_case_id uuid,
  p_generation integer,
  p_endpoint text,
  p_p256dh text,
  p_auth text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (p_user_id is null) = (p_case_id is null) then
    raise exception 'Un membre ou un dossier' using errcode = '22023';
  end if;

  if p_user_id is not null then
    if not exists (
      select 1 from public.profiles p
      where p.id = p_user_id and p.agency_id = p_agency_id and p.is_active
    ) then
      raise exception 'Membre introuvable' using errcode = '42501';
    end if;
  elsif not exists (
    select 1 from public.student_access_open(p_case_id, p_agency_id) o
    where o.generation = p_generation
  ) then
    raise exception 'Accès fermé' using errcode = '42501';
  end if;

  -- clock_timestamp : l'ordre reste juste pour plusieurs appareils
  -- enregistrés dans une même transaction
  insert into public.push_subscriptions
    (agency_id, user_id, case_id, student_generation, endpoint, p256dh, auth, created_at)
  values (p_agency_id, p_user_id, p_case_id,
    case when p_case_id is null then null else p_generation end,
    p_endpoint, p_p256dh, p_auth, clock_timestamp())
  on conflict (endpoint) do update set
    agency_id = excluded.agency_id,
    user_id = excluded.user_id,
    case_id = excluded.case_id,
    student_generation = excluded.student_generation,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    created_at = excluded.created_at;

  delete from public.push_subscriptions s
  where s.id in (
    select s2.id from public.push_subscriptions s2
    where (p_user_id is not null and s2.user_id = p_user_id)
       or (p_case_id is not null and s2.case_id = p_case_id)
    order by s2.created_at desc
    offset case when p_user_id is null then 5 else 10 end
  );
end;
$$;

-- 3. Destinataires ----------------------------------------------------------------

-- Appareils à prévenir d'un événement venu du candidat (p_kind :
-- student_message, student_review) : ceux du responsable du dossier, ou des
-- patrons si le dossier n'a pas de responsable actif ; chacun selon ses
-- choix.
create function public.push_targets_case(p_agency_id uuid, p_case_id uuid, p_kind text)
returns table (id uuid, endpoint text, p256dh text, auth text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('student_message', 'student_review') then
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
      else coalesce(n.student_reviews, true)
    end;
end;
$$;

-- Appareils d'un membre actif à qui un collègue vient de confier une tâche
create function public.push_targets_assigned_task(p_agency_id uuid, p_user_id uuid)
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.endpoint, s.p256dh, s.auth
  from public.profiles p
  join public.push_subscriptions s on s.user_id = p.id
  left join public.notification_preferences n on n.user_id = p.id
  where p.id = p_user_id
    and p.agency_id = p_agency_id
    and p.is_active and not p.must_change_password
    and coalesce(n.assigned_tasks, true)
$$;

-- Appareils du candidat d'un dossier, pour l'accès en cours seulement : un
-- accès fermé ou un nouveau code ne reçoit plus rien
create function public.push_targets_student(p_agency_id uuid, p_case_id uuid)
returns table (id uuid, endpoint text, p256dh text, auth text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.endpoint, s.p256dh, s.auth
  from public.push_subscriptions s
  join public.student_access_open(p_case_id, p_agency_id) o
    on o.generation = s.student_generation
  where s.case_id = p_case_id
    and s.agency_id = p_agency_id
$$;

-- 4. Récapitulatif du matin ---------------------------------------------------------

-- Membres à prévenir ce jour (p_today, jour de l'application) : récapitulatif
-- demandé, au moins un appareil, des tâches à faire pour aujourd'hui ou en
-- retard (campagnes actives, comme la page Tâches), agence non expirée.
-- Chacun n'est rendu qu'une fois par jour, même si la tâche planifiée est
-- relancée.
create function public.claim_task_digests(p_today date)
returns table (user_id uuid, agency_id uuid, due_today integer, overdue integer)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select t.assigned_to as user_id,
      count(*) filter (where t.due_date = p_today)::integer as due_today,
      count(*) filter (where t.due_date < p_today)::integer as overdue
    from public.case_tasks t
    join public.cases c on c.id = t.case_id and c.agency_id = t.agency_id
    join public.campaigns k on k.id = c.campaign_id and k.agency_id = c.agency_id
    where t.done_at is null
      and t.due_date <= p_today
      and k.status <> 'archived'
    group by t.assigned_to
  )
  update public.notification_preferences n
  set daily_sent_on = p_today
  from due d, public.profiles p
  where n.user_id = d.user_id
    and p.id = n.user_id
    and p.is_active and not p.must_change_password
    and n.daily_tasks
    and n.daily_sent_on is distinct from p_today
    and exists (select 1 from public.push_subscriptions s where s.user_id = n.user_id)
    and (select a.state from public.agency_subscription(n.agency_id) a) <> 'expired'
  returning n.user_id, n.agency_id, d.due_today, d.overdue
$$;

-- Droits ------------------------------------------------------------------------------

-- Le serveur lit, et retire un appareil (désactivé, déconnecté, ou que le
-- service de notification ne connaît plus) ; il écrit par les fonctions
grant select, delete on public.push_subscriptions to service_role;
grant select on public.notification_preferences to service_role;

revoke execute on function public.save_notification_preferences(uuid, uuid, boolean, boolean, boolean, boolean) from public;

revoke execute on function public.save_push_subscription(uuid, uuid, uuid, integer, text, text, text) from public;
revoke execute on function public.push_targets_case(uuid, uuid, text) from public;
revoke execute on function public.push_targets_assigned_task(uuid, uuid) from public;
revoke execute on function public.push_targets_student(uuid, uuid) from public;
revoke execute on function public.claim_task_digests(date) from public;

grant execute on function public.save_notification_preferences(uuid, uuid, boolean, boolean, boolean, boolean) to service_role;
grant execute on function public.save_push_subscription(uuid, uuid, uuid, integer, text, text, text) to service_role;
grant execute on function public.push_targets_case(uuid, uuid, text) to service_role;
grant execute on function public.push_targets_assigned_task(uuid, uuid) to service_role;
grant execute on function public.push_targets_student(uuid, uuid) to service_role;
grant execute on function public.claim_task_digests(date) to service_role;
