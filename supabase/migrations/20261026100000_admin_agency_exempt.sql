-- Migration : admin_agency_exempt
-- L'agence de l'administrateur de la plateforme n'a pas d'abonnement : ni
-- essai, ni date de fin, ni lecture seule. Est exemptée toute agence dont un
-- membre figure dans platform_admins ; retirer ce droit la ramène au régime
-- normal (sa date de fin s'applique de nouveau).

create function public.agency_is_exempt(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    join public.platform_admins pa on pa.user_id = p.id
    where p.agency_id = p_agency_id
  )
$$;

-- exempt : agence de l'administrateur ; sinon comme avant
create or replace function public.agency_subscription(p_agency_id uuid)
returns table (ends_at timestamptz, state text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.subscription_ends_at,
    case
      when public.agency_is_exempt(a.id) then 'exempt'
      when a.subscription_ends_at <= now() then 'expired'
      when a.subscription_granted then 'active'
      when exists (select 1 from public.platform_payments p
                   where p.agency_id = a.id and p.cancelled_at is null) then 'active'
      else 'trial'
    end
  from public.agencies a
  where a.id = p_agency_id
$$;

create or replace function public.require_writable_agency(p_agency_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.agencies
             where id = p_agency_id and subscription_ends_at <= now())
     and not public.agency_is_exempt(p_agency_id) then
    raise exception 'Abonnement expiré : agence en lecture seule' using errcode = '25006';
  end if;
end;
$$;

revoke execute on function public.agency_is_exempt(uuid) from public;
