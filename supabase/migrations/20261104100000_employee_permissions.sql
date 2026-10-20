-- Migration : employee_permissions
-- Permissions accordées par le patron à un employé de confiance, en plus de
-- ce que tout membre peut faire. Le patron les a toutes, toujours.
-- - payments_view : voir la caisse (page Paiements, chiffres du tableau de
--   bord, export) ; contrôlé par le serveur de l'appli, la lecture des
--   paiements étant déjà ouverte à l'agence (RLS)
-- - payments_manage : annuler un paiement, modifier un montant convenu
-- - campaigns_manage : créer, modifier, archiver, supprimer une campagne
--   vide et changer ses étapes
-- L'équipe, les réglages de l'agence et l'abonnement restent au patron.

alter table public.profiles
  add column permissions text[] not null default '{}'
    check (permissions <@ array['payments_view', 'payments_manage', 'campaigns_manage']);

-- Vrai si l'acteur est un membre ACTIF de l'agence et a la permission
-- (le patron les a toutes)
create function public.has_permission(p_actor_id uuid, p_agency_id uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'owner' or p_permission = any (permissions)
     from public.profiles
     where id = p_actor_id and agency_id = p_agency_id and is_active),
    false
  )
$$;

-- Comme require_owner, pour une action qu'une permission peut ouvrir
create function public.require_permission(p_actor_id uuid, p_agency_id uuid, p_permission text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_active_member(p_actor_id, p_agency_id);
  if not public.has_permission(p_actor_id, p_agency_id, p_permission) then
    raise exception 'Vous n''avez pas la permission de faire cette action'
      using errcode = '42501';
  end if;
end;
$$;

-- Permissions d'un employé (patron seulement ; jamais un patron, ni
-- soi-même). La liste est enregistrée triée et sans doublon. Renvoie vrai si
-- elle a changé.
create function public.set_employee_permissions(
  p_agency_id uuid,
  p_actor_id uuid,
  p_employee_id uuid,
  p_permissions text[]
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_old text[];
  v_new text[];
begin
  perform public.require_owner(p_actor_id, p_agency_id);

  select role, permissions into v_role, v_old
  from public.profiles
  where id = p_employee_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Employé introuvable' using errcode = 'P0002';
  end if;
  if v_role <> 'employee' then
    raise exception 'Le patron a déjà toutes les permissions' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct p order by p), '{}') into v_new
  from unnest(coalesce(p_permissions, '{}')) as p;
  if not v_new <@ array['payments_view', 'payments_manage', 'campaigns_manage'] then
    raise exception 'Permission inconnue' using errcode = '22023';
  end if;
  if v_new = v_old then
    return false;
  end if;

  update public.profiles set permissions = v_new
  where id = p_employee_id and agency_id = p_agency_id;
  return true;
end;
$$;

-- Fonctions existantes : seule la ligne de contrôle change (patron →
-- permission). Corps repris tels qu'ils sont en base avant cette migration.

CREATE OR REPLACE FUNCTION public.create_campaign(p_agency_id uuid, p_actor_id uuid, p_name text, p_template_key text, p_suggested_platforms text[], p_dates jsonb, p_infos jsonb, p_groups text[], p_default_fee integer DEFAULT NULL::integer, p_stages text[] DEFAULT '{}'::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
begin
  perform public.require_permission(p_actor_id, p_agency_id, 'campaigns_manage');

  if cardinality(coalesce(p_groups, '{}')) > 30 then
    raise exception 'Trop de groupes' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_stages, '{}')) > 15
     or (select count(distinct lower(btrim(s))) from unnest(coalesce(p_stages, '{}')) as s)
        <> cardinality(coalesce(p_stages, '{}')) then
    raise exception 'Étapes invalides' using errcode = '22023';
  end if;

  insert into public.campaigns (
    agency_id, name, template_key, suggested_platforms, default_fee, created_by
  ) values (
    p_agency_id, p_name, p_template_key, coalesce(p_suggested_platforms, '{}'),
    p_default_fee, p_actor_id
  )
  returning id into v_id;

  perform public.replace_campaign_details(v_id, p_agency_id, p_dates, p_infos);

  insert into public.campaign_groups (agency_id, campaign_id, name, position, created_by)
  select p_agency_id, v_id, g.name, (g.ordinality - 1)::integer, p_actor_id
  from unnest(coalesce(p_groups, '{}')) with ordinality as g(name, ordinality);

  insert into public.campaign_stages (agency_id, campaign_id, name, position)
  select p_agency_id, v_id, s.name, (s.ordinality - 1)::smallint
  from unnest(coalesce(p_stages, '{}')) with ordinality as s(name, ordinality);

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_campaign(p_campaign_id uuid, p_agency_id uuid, p_actor_id uuid, p_name text, p_suggested_platforms text[], p_dates jsonb, p_infos jsonb, p_default_fee integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_permission(p_actor_id, p_agency_id, 'campaigns_manage');

  perform 1 from public.campaigns
  where id = p_campaign_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;
  perform public.assert_campaign_active(p_campaign_id);

  update public.campaigns
  set name = p_name,
      suggested_platforms = coalesce(p_suggested_platforms, '{}'),
      default_fee = p_default_fee
  where id = p_campaign_id and agency_id = p_agency_id;

  perform public.replace_campaign_details(p_campaign_id, p_agency_id, p_dates, p_infos);
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_campaign_status(p_campaign_id uuid, p_agency_id uuid, p_actor_id uuid, p_status text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_permission(p_actor_id, p_agency_id, 'campaigns_manage');

  if p_status is null or p_status not in ('active', 'archived') then
    raise exception 'Statut invalide' using errcode = '22023';
  end if;

  update public.campaigns
  set status = p_status
  where id = p_campaign_id and agency_id = p_agency_id and status <> p_status;
  if found then
    return true;
  end if;

  if not exists (
    select 1 from public.campaigns
    where id = p_campaign_id and agency_id = p_agency_id
  ) then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;
  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.delete_campaign(p_campaign_id uuid, p_agency_id uuid, p_actor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  perform public.require_permission(p_actor_id, p_agency_id, 'campaigns_manage');

  begin
    delete from public.campaigns
    where id = p_campaign_id and agency_id = p_agency_id;
  exception when foreign_key_violation then
    -- Les dossiers référencent la campagne (voir cases) : la base refuse
    raise exception 'Cette campagne contient des dossiers : archivez-la'
      using errcode = '2BP01';
  end;

  if not found then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.replace_campaign_stages(p_campaign_id uuid, p_agency_id uuid, p_actor_id uuid, p_stages jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_old uuid[];
  v_ids uuid[] := '{}';
  v_item record;
  v_id uuid;
  v_target uuid;
  v_moved integer := 0;
  v_count integer;
begin
  perform public.require_permission(p_actor_id, p_agency_id, 'campaigns_manage');

  if jsonb_typeof(p_stages) is distinct from 'array'
     or jsonb_array_length(p_stages) > 15
     or (select count(distinct lower(btrim(s ->> 'name')))
         from jsonb_array_elements(p_stages) as s) <> jsonb_array_length(p_stages) then
    raise exception 'Étapes invalides' using errcode = '22023';
  end if;

  perform 1 from public.campaigns
  where id = p_campaign_id and agency_id = p_agency_id
  for update;
  if not found then
    raise exception 'Campagne introuvable' using errcode = 'P0002';
  end if;
  perform public.assert_campaign_active(p_campaign_id);

  v_old := array(
    select id from public.campaign_stages
    where campaign_id = p_campaign_id
    order by position
  );

  for v_item in
    select value, ordinality from jsonb_array_elements(p_stages) with ordinality
  loop
    v_id := nullif(v_item.value ->> 'id', '')::uuid;
    if v_id is null then
      insert into public.campaign_stages (agency_id, campaign_id, name, position)
      values (p_agency_id, p_campaign_id, v_item.value ->> 'name',
              (v_item.ordinality - 1)::smallint)
      returning id into v_id;
    else
      if v_id = any (v_ids) then
        raise exception 'Étapes invalides' using errcode = '22023';
      end if;
      update public.campaign_stages
      set name = v_item.value ->> 'name',
          position = (v_item.ordinality - 1)::smallint
      where id = v_id and campaign_id = p_campaign_id and agency_id = p_agency_id;
      if not found then
        raise exception 'Étape introuvable' using errcode = '22023';
      end if;
    end if;
    v_ids := v_ids || v_id;
  end loop;

  -- Étapes retirées : leurs dossiers reculent à l'étape gardée précédente
  for i in 1 .. coalesce(array_length(v_old, 1), 0) loop
    if not (v_old[i] = any (v_ids)) then
      v_target := null;
      for j in reverse i - 1 .. 1 loop
        if v_old[j] = any (v_ids) then
          v_target := v_old[j];
          exit;
        end if;
      end loop;
      v_target := coalesce(v_target, v_ids[1]);

      update public.cases set stage_id = v_target
      where stage_id = v_old[i] and agency_id = p_agency_id;
      get diagnostics v_count = row_count;
      v_moved := v_moved + v_count;

      delete from public.campaign_stages where id = v_old[i];
    end if;
  end loop;

  if v_ids[1] is not null then
    update public.cases set stage_id = v_ids[1]
    where campaign_id = p_campaign_id and agency_id = p_agency_id
      and stage_id is null;
    get diagnostics v_count = row_count;
    v_moved := v_moved + v_count;
  end if;

  return v_moved;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_case_agreed_amount(p_case_id uuid, p_agency_id uuid, p_actor_id uuid, p_amount integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lock record;
begin
  select * into v_lock from public.lock_case_payments(p_case_id, p_agency_id, p_actor_id);

  if p_amount is null or not public.is_valid_amount(p_amount) then
    raise exception 'Montant invalide' using errcode = '23514';
  end if;
  if v_lock.agreed is not distinct from p_amount then
    return false;
  end if;
  if v_lock.agreed is not null
     and not public.has_permission(p_actor_id, p_agency_id, 'payments_manage') then
    raise exception 'Vous n''avez pas la permission de modifier le montant convenu'
      using errcode = '42501';
  end if;
  if p_amount < v_lock.paid then
    raise exception 'Le montant convenu ne peut pas être inférieur au total déjà payé'
      using errcode = '22003';
  end if;

  update public.cases set agreed_amount = p_amount
  where id = p_case_id and agency_id = p_agency_id;
  return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.cancel_case_payment(p_payment_id uuid, p_case_id uuid, p_agency_id uuid, p_actor_id uuid, p_reason text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_lock record;
  v_amount integer;
begin
  select * into v_lock from public.lock_case_payments(p_case_id, p_agency_id, p_actor_id);
  if not public.has_permission(p_actor_id, p_agency_id, 'payments_manage') then
    raise exception 'Vous n''avez pas la permission d''annuler un paiement'
      using errcode = '42501';
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
$function$;

-- Droits --------------------------------------------------------------------

revoke execute on function public.has_permission(uuid, uuid, text) from public;
revoke execute on function public.require_permission(uuid, uuid, text) from public;
revoke execute on function public.set_employee_permissions(uuid, uuid, uuid, text[]) from public;

grant execute on function public.set_employee_permissions(uuid, uuid, uuid, text[])
  to service_role;
