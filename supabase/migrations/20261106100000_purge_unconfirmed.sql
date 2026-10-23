-- Migration : purge_unconfirmed
-- Inscriptions jamais confirmées : une agence dont le patron n'a pas cliqué
-- sur le lien de confirmation dans les 7 jours est supprimée, avec son
-- compte. L'adresse e-mail redevient libre (faute de frappe, adresse d'un
-- autre). Seulement une agence restée vide : le patron n'a jamais pu se
-- connecter, rien n'a pu y être ajouté.

-- La suppression passe par des règles qui la refusent d'ordinaire (un
-- patron ne se supprime pas, une agence expirée est en lecture seule). Ces
-- deux règles laissent passer la seule purge ci-dessous, signalée par un
-- réglage local à sa transaction (tremplia.purge), qu'aucun client ne peut
-- poser : le navigateur n'a aucun droit de suppression, le serveur passe par
-- cette fonction.

create or replace function public.enforce_agency_writable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('tremplia.purge', true) = 'on' then
      return old;
    end if;
    perform public.require_writable_agency(old.agency_id);
    return old;
  end if;
  perform public.require_writable_agency(new.agency_id);
  return new;
end;
$$;

create or replace function public.profiles_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('tremplia.purge', true) = 'on' then
    return old;
  end if;
  if old.role <> 'employee' or old.is_active then
    raise exception 'Seul un employé désactivé peut être supprimé'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

-- Supprime les inscriptions non confirmées depuis plus de p_age. Renvoie le
-- nombre de comptes supprimés. Un compte n'est supprimé que si :
-- - son adresse n'a jamais été confirmée et il a été créé avant now() - p_age ;
-- - il n'est pas administrateur de la plateforme ;
-- - son agence (s'il en a une) n'a que lui pour membre, aucune campagne,
--   aucun dossier et aucun paiement d'abonnement.
create function public.purge_unconfirmed_registrations(p_age interval default interval '7 days')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user record;
  v_count integer := 0;
begin
  if p_age < interval '1 day' then
    raise exception 'Délai trop court' using errcode = '22023';
  end if;

  perform set_config('tremplia.purge', 'on', true);

  for v_user in
    select u.id, p.agency_id
    from auth.users u
    left join public.profiles p on p.id = u.id
    where u.email_confirmed_at is null
      and u.created_at < now() - p_age
      and not exists (select 1 from public.platform_admins a where a.user_id = u.id)
      and (
        p.id is null
        or (
          p.role = 'owner'
          and not exists (select 1 from public.profiles o
                          where o.agency_id = p.agency_id and o.id <> u.id)
          and not exists (select 1 from public.campaigns c where c.agency_id = p.agency_id)
          and not exists (select 1 from public.cases c where c.agency_id = p.agency_id)
          and not exists (select 1 from public.platform_payments pp
                          where pp.agency_id = p.agency_id)
        )
      )
    for update of u skip locked
  loop
    if v_user.agency_id is not null then
      delete from public.agencies where id = v_user.agency_id;
    end if;
    delete from auth.users where id = v_user.id;
    v_count := v_count + 1;
  end loop;

  perform set_config('tremplia.purge', 'off', true);
  return v_count;
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on function public.purge_unconfirmed_registrations(interval) from public;
grant execute on function public.purge_unconfirmed_registrations(interval) to service_role;
