-- Migration : dashboard_layouts
-- Disposition du tableau de bord : les widgets affichés, leur ordre et leur
-- taille. Chaque membre peut avoir la sienne ; sans elle, il voit celle de
-- l'agence (choisie par le patron), sinon celle de l'application.
--
-- Le contenu (identifiants des widgets, tailles) est vérifié par le serveur,
-- qui ignore à la lecture les widgets qu'il ne connaît plus. La base ne
-- contrôle que la forme et la taille. Une préférence d'affichage, pas une
-- donnée de l'agence : elle reste modifiable en lecture seule.

create table public.dashboard_layouts (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  -- Vide : la disposition de l'agence
  user_id uuid,
  layout jsonb not null check (
    jsonb_typeof(layout) = 'array'
    and jsonb_array_length(layout) <= 40
    and octet_length(layout::text) <= 4000
  ),
  updated_at timestamptz not null default now(),
  constraint dashboard_layouts_user_fk foreign key (user_id, agency_id)
    references public.profiles (id, agency_id) on delete cascade
);

create unique index dashboard_layouts_user_idx
  on public.dashboard_layouts (user_id) where user_id is not null;
create unique index dashboard_layouts_agency_idx
  on public.dashboard_layouts (agency_id) where user_id is null;

alter table public.dashboard_layouts enable row level security;

-- Enregistre la disposition d'un membre actif (p_for_agency faux) ou celle
-- de l'agence (p_for_agency vrai, patron seulement). p_layout vide : retour
-- à la disposition par défaut.
create function public.save_dashboard_layout(
  p_agency_id uuid,
  p_user_id uuid,
  p_layout jsonb,
  p_for_agency boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_target uuid;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = p_user_id and p.agency_id = p_agency_id and p.is_active;
  if v_role is null then
    raise exception 'Membre introuvable' using errcode = '42501';
  end if;
  if p_for_agency and v_role <> 'owner' then
    raise exception 'Réservé au patron' using errcode = '42501';
  end if;

  v_target := case when p_for_agency then null else p_user_id end;

  delete from public.dashboard_layouts d
  where d.agency_id = p_agency_id and d.user_id is not distinct from v_target;

  if p_layout is not null then
    insert into public.dashboard_layouts (agency_id, user_id, layout)
    values (p_agency_id, v_target, p_layout);
  end if;
end;
$$;

grant select on public.dashboard_layouts to service_role;

revoke execute on function public.save_dashboard_layout(uuid, uuid, jsonb, boolean) from public;
grant execute on function public.save_dashboard_layout(uuid, uuid, jsonb, boolean) to service_role;
