-- Migration : delete_agency
-- Suppression d'une agence par l'administrateur de la plateforme : agence,
-- campagnes, dossiers, documents, paiements, messages, historique, et
-- comptes de connexion de tous ses membres. Les fichiers du stockage sont
-- supprimés ensuite par le serveur (la base ne peut pas les effacer).
--
-- Les règles qui protègent les données d'une agence en temps normal
-- (lecture seule après l'abonnement, document verrouillé, campagne
-- archivée, patron non supprimable, mot de passe de plateforme lié à son
-- compte, avis du candidat remis à zéro) laissent passer les seules
-- suppressions de ce type, signalées par le réglage local tremplia.purge
-- (aussi utilisé par purge_unconfirmed_registrations). Aucun client ne
-- peut le poser : le navigateur n'a aucun droit d'écriture, le serveur
-- passe par ces fonctions.

-- Purge en cours dans cette transaction ?
create function public.is_purging()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('tremplia.purge', true), '') = 'on'
$$;

create or replace function public.enforce_agency_writable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_purging() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
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
  if public.is_purging() then
    return old;
  end if;
  if old.role <> 'employee' or old.is_active then
    raise exception 'Seul un employé désactivé peut être supprimé'
      using errcode = '42501';
  end if;
  return old;
end;
$$;

create or replace function public.documents_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_purging() then
    return old;
  end if;
  if old.locked_at is not null then
    raise exception 'Document verrouillé : il ne peut plus être supprimé'
      using errcode = '55006';
  end if;
  return old;
end;
$$;

create or replace function public.document_folders_before_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_purging() then
    return old;
  end if;
  if exists (
    select 1 from public.documents
    where folder_id = old.id and locked_at is not null
  ) then
    raise exception 'Ce dossier contient un document verrouillé : il ne peut pas être supprimé'
      using errcode = '55006';
  end if;
  return old;
end;
$$;

create or replace function public.campaign_details_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_purging() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform public.assert_campaign_active(old.campaign_id);
    return old;
  end if;
  if tg_op = 'UPDATE'
     and (new.agency_id is distinct from old.agency_id
          or new.campaign_id is distinct from old.campaign_id) then
    raise exception 'Une ligne ne change pas de campagne' using errcode = '42501';
  end if;
  perform public.assert_campaign_active(new.campaign_id);
  return new;
end;
$$;

create or replace function public.campaign_groups_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_purging() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    perform public.assert_campaign_active(old.campaign_id);
    return old;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.agency_id is distinct from old.agency_id
       or new.campaign_id is distinct from old.campaign_id
       or new.created_at is distinct from old.created_at
       or (new.created_by is distinct from old.created_by
           and new.created_by is not null) then
      raise exception 'Ces colonnes du groupe ne sont pas modifiables'
        using errcode = '42501';
    end if;
    if new.name is not distinct from old.name
       and new.position is not distinct from old.position then
      -- Seul created_by change (profil supprimé) : toujours permis
      return new;
    end if;
    new.updated_at := now();
  end if;

  perform public.assert_campaign_active(new.campaign_id);
  return new;
end;
$$;

create or replace function public.reset_student_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case uuid;
  v_agency uuid;
begin
  if public.is_purging() then
    return null;
  end if;
  if tg_op = 'DELETE' then
    v_case := old.case_id;
    v_agency := old.agency_id;
  else
    v_case := new.case_id;
    v_agency := new.agency_id;
  end if;

  update public.case_student_reviews
  set status = 'pending', updated_at = now()
  where case_id = v_case and agency_id = v_agency and status <> 'pending';
  return null;
end;
$$;

create or replace function public.external_account_secrets_after_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.is_purging() then
    return null;
  end if;
  if tg_op = 'DELETE' then
    perform public.check_external_account_secret(old.account_id);
  else
    perform public.check_external_account_secret(new.account_id);
  end if;
  return null;
end;
$$;

-- Supprime une agence et tout ce qui la concerne. Renvoie les identifiants
-- des comptes supprimés. Jamais l'agence d'un administrateur.
create function public.delete_agency(p_admin_id uuid, p_agency_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_users uuid[];
begin
  perform public.require_platform_admin(p_admin_id);

  if not exists (select 1 from public.agencies where id = p_agency_id) then
    raise exception 'Agence introuvable' using errcode = 'P0002';
  end if;
  if public.agency_is_exempt(p_agency_id) then
    raise exception 'L''agence de l''administrateur ne peut pas être supprimée'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(id), '{}') into v_users
  from public.profiles where agency_id = p_agency_id;

  perform set_config('tremplia.purge', 'on', true);
  delete from public.agencies where id = p_agency_id;
  delete from auth.users where id = any(v_users);
  perform set_config('tremplia.purge', 'off', true);

  return v_users;
end;
$$;

-- Droits --------------------------------------------------------------------

revoke execute on function public.is_purging() from public;
-- Lue par les règles ci-dessus, qui s'exécutent aussi avec les droits du
-- serveur (écritures directes sur les tables qui lui sont accordées)
grant execute on function public.is_purging() to service_role;
revoke execute on function public.delete_agency(uuid, uuid) from public;
grant execute on function public.delete_agency(uuid, uuid) to service_role;
