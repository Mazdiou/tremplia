-- Migration : case_payment_totals
-- Total payé et reste à payer gardés sur le dossier, tenus à jour par les
-- fonctions de paiement (qui verrouillent déjà le dossier) : l'arbre, les
-- filtres et le tableau de bord les lisent sans recalcul.
-- - cases.paid_amount : somme des paiements non annulés
-- - cases.remaining_amount : montant convenu moins payé (vide : montant non
--   fixé), calculé par la base
-- - case_stats : sommes et compteurs des paiements, en plus des dossiers
-- - payment_months : encaissements par campagne et par mois

alter table public.cases
  add column paid_amount integer not null default 0,
  add column remaining_amount integer
    generated always as (agreed_amount - paid_amount) stored;

update public.cases c
set paid_amount = t.paid
from (
  select case_id, sum(amount)::integer as paid
  from public.case_payments
  where cancelled_at is null
  group by case_id
) t
where t.case_id = c.id;

-- Jamais payé plus que convenu, jamais de paiement sans montant convenu
alter table public.cases
  add constraint cases_paid_within_agreed check (
    paid_amount >= 0
    and (agreed_amount is not null or paid_amount = 0)
    and paid_amount <= coalesce(agreed_amount, 0)
  );

-- Dossiers qui doivent encore de l'argent (tableau de bord, filtre)
create index cases_remaining_idx
  on public.cases (agency_id, campaign_id, remaining_amount desc)
  where remaining_amount > 0;

-- Fonctions : le total vient du dossier verrouillé ---------------------------

create or replace function public.lock_case_payments(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  out role text,
  out agreed integer,
  out paid bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  role := public.require_active_member(p_actor_id, p_agency_id);

  select c.agreed_amount, c.paid_amount into agreed, paid
  from public.cases c
  where c.id = p_case_id and c.agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Dossier introuvable' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.record_case_payment(
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_amount integer,
  p_paid_on date,
  p_method text,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock record;
  v_id uuid;
begin
  select * into v_lock from public.lock_case_payments(p_case_id, p_agency_id, p_actor_id);

  if v_lock.agreed is null then
    raise exception 'Indiquez d''abord le montant convenu' using errcode = '55000';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount > v_lock.agreed - v_lock.paid then
    raise exception 'Le paiement dépasse le reste à payer' using errcode = '22003';
  end if;
  -- Pas de date future (fuseau de l'application)
  if p_paid_on is null or p_paid_on > (now() at time zone 'Africa/Algiers')::date then
    raise exception 'Date de paiement invalide' using errcode = '22007';
  end if;
  if (select count(*) from public.case_payments where case_id = p_case_id) >= 200 then
    raise exception 'Limite de 200 paiements par dossier atteinte' using errcode = '54000';
  end if;

  insert into public.case_payments (
    agency_id, case_id, amount, paid_on, method, note, created_by
  ) values (
    p_agency_id, p_case_id, p_amount, p_paid_on, p_method, p_note, p_actor_id
  )
  returning id into v_id;

  update public.cases set paid_amount = paid_amount + p_amount
  where id = p_case_id and agency_id = p_agency_id;
  return v_id;
end;
$$;

create or replace function public.cancel_case_payment(
  p_payment_id uuid,
  p_case_id uuid,
  p_agency_id uuid,
  p_actor_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lock record;
  v_amount integer;
begin
  select * into v_lock from public.lock_case_payments(p_case_id, p_agency_id, p_actor_id);
  if v_lock.role <> 'owner' then
    raise exception 'Seul le patron annule un paiement' using errcode = '42501';
  end if;

  update public.case_payments
  set cancelled_by = p_actor_id,
      cancelled_at = now(),
      cancel_reason = p_reason
  where id = p_payment_id
    and case_id = p_case_id
    and agency_id = p_agency_id
    and cancelled_at is null
  returning amount into v_amount;
  if found then
    update public.cases set paid_amount = paid_amount - v_amount
    where id = p_case_id and agency_id = p_agency_id;
    return v_amount;
  end if;

  if exists (
    select 1 from public.case_payments
    where id = p_payment_id and case_id = p_case_id and agency_id = p_agency_id
  ) then
    raise exception 'Ce paiement est déjà annulé' using errcode = '55000';
  end if;
  raise exception 'Paiement introuvable' using errcode = 'P0002';
end;
$$;

-- Compteurs ------------------------------------------------------------------
-- Les dossiers abandonnés ne comptent pas dans ce qui reste à encaisser.

create or replace view public.case_stats
with (security_invoker = true)
as
select
  campaign_id,
  status,
  education_level,
  assigned_to,
  count(*)::integer as cases,
  (count(*) filter (where created_at >= now() - interval '7 days'))::integer
    as created_last_week,
  coalesce(sum(remaining_amount) filter (where status <> 'abandoned'), 0)::bigint
    as remaining,
  (count(*) filter (where remaining_amount > 0 and status <> 'abandoned'))::integer
    as owing,
  (count(*) filter (where agreed_amount is null and status = 'active'))::integer
    as fee_unset
from public.cases
group by campaign_id, status, education_level, assigned_to;

-- Encaissements (paiements non annulés) par campagne et par mois
create view public.payment_months
with (security_invoker = true)
as
select
  c.campaign_id,
  date_trunc('month', p.paid_on)::date as month,
  sum(p.amount)::bigint as amount,
  count(*)::integer as payments
from public.case_payments p
join public.cases c on c.id = p.case_id
where p.cancelled_at is null
group by c.campaign_id, date_trunc('month', p.paid_on);

grant select on public.payment_months to authenticated;
