begin;
select plan(17);

-- Agence A : patron P, employé E, employé D (désactivé). Agence B : patron Q.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'p@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'e@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'q@test.local');

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');
select public.create_agency_with_owner(
  '33333333-3333-3333-3333-333333333333', 'Agence B', 'Oran', '0555000002', 'Patron', 'B');

insert into public.profiles (id, agency_id, first_name, last_name, role, is_active)
select v.id, p.agency_id, v.fn, 'A', 'employee', v.active
from public.profiles p,
  (values
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Employe', true),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'Desactive', false)
  ) as v(id, fn, active)
where p.id = '11111111-1111-1111-1111-111111111111';

create temp table ctx as
select
  (select agency_id from public.profiles where id = '11111111-1111-1111-1111-111111111111') as a,
  (select agency_id from public.profiles where id = '33333333-3333-3333-3333-333333333333') as b;
grant select on ctx to public;

-- Lignes de l'agence A seulement : la base locale contient d'autres agences
create function pg_temp.layouts(p_user uuid)
returns bigint language sql as $$
  select count(*) from public.dashboard_layouts d
  where d.agency_id = (select a from ctx) and d.user_id is not distinct from p_user
$$;

-- Aucun accès direct depuis le navigateur
select ok((select relrowsecurity from pg_class where oid = 'public.dashboard_layouts'::regclass),
  'RLS activé');
select ok(not has_table_privilege('anon', 'public.dashboard_layouts', 'select'),
  'anon ne lit pas les dispositions');
select ok(not has_table_privilege('authenticated', 'public.dashboard_layouts', 'insert'),
  'un membre connecté n''écrit pas directement');
select ok(not has_function_privilege('authenticated',
  'public.save_dashboard_layout(uuid, uuid, jsonb, boolean)', 'execute'),
  'la fonction est réservée au serveur');

-- Disposition de l'employé, remplacée au deuxième enregistrement
select public.save_dashboard_layout((select a from ctx), '22222222-2222-2222-2222-222222222222',
  '[{"id": "todo", "size": "full"}]', false);
select public.save_dashboard_layout((select a from ctx), '22222222-2222-2222-2222-222222222222',
  '[{"id": "tasks", "size": "half"}, {"id": "todo", "size": "full"}]', false);
select is(pg_temp.layouts('22222222-2222-2222-2222-222222222222'), 1::bigint,
  'une seule disposition par membre');
select is(
  (select layout -> 0 ->> 'id' from public.dashboard_layouts
   where user_id = '22222222-2222-2222-2222-222222222222'),
  'tasks', 'la nouvelle disposition remplace l''ancienne');

-- Disposition de l'agence : patron seulement
select public.save_dashboard_layout((select a from ctx), '11111111-1111-1111-1111-111111111111',
  '[{"id": "payments", "size": "full"}]', true);
select is(pg_temp.layouts(null), 1::bigint, 'le patron enregistre celle de l''agence');
select is(pg_temp.layouts('11111111-1111-1111-1111-111111111111'), 0::bigint,
  'sans toucher à la sienne');
select throws_ok(
  $$select public.save_dashboard_layout((select a from ctx),
    '22222222-2222-2222-2222-222222222222', '[]', true)$$,
  '42501', null, 'un employé ne change pas celle de l''agence');

-- Membres refusés
select throws_ok(
  $$select public.save_dashboard_layout((select a from ctx),
    '44444444-4444-4444-4444-444444444444', '[]', false)$$,
  '42501', null, 'un employé désactivé est refusé');
select throws_ok(
  $$select public.save_dashboard_layout((select b from ctx),
    '22222222-2222-2222-2222-222222222222', '[]', false)$$,
  '42501', null, 'un membre d''une autre agence est refusé');

-- Forme contrôlée par la base
select throws_ok(
  $$select public.save_dashboard_layout((select a from ctx),
    '22222222-2222-2222-2222-222222222222', '{"id": "todo"}', false)$$,
  '23514', null, 'un objet au lieu d''une liste est refusé');
select throws_ok(
  format($$select public.save_dashboard_layout((select a from ctx),
    '22222222-2222-2222-2222-222222222222', '%s', false)$$,
    (select jsonb_agg(jsonb_build_object('id', 'w' || i, 'size', 'half'))
     from generate_series(1, 41) i)),
  '23514', null, 'plus de 40 widgets refusés');

-- Retour à la disposition par défaut
select public.save_dashboard_layout((select a from ctx), '22222222-2222-2222-2222-222222222222',
  null, false);
select is(pg_temp.layouts('22222222-2222-2222-2222-222222222222'), 0::bigint,
  'sans disposition : retour au défaut');
select is(pg_temp.layouts(null), 1::bigint, 'celle de l''agence reste');

-- Employé supprimé : sa disposition part avec lui
select public.save_dashboard_layout((select a from ctx), '22222222-2222-2222-2222-222222222222',
  '[]', false);
update public.profiles set is_active = false where id = '22222222-2222-2222-2222-222222222222';
delete from public.profiles where id = '22222222-2222-2222-2222-222222222222';
select is(pg_temp.layouts('22222222-2222-2222-2222-222222222222'), 0::bigint,
  'supprimée avec le membre');

-- Abonnement expiré : la préférence reste modifiable
update public.agencies set subscription_ends_at = now() - interval '1 day',
  subscription_granted = true
where id = (select a from ctx);
select lives_ok(
  $$select public.save_dashboard_layout((select a from ctx),
    '11111111-1111-1111-1111-111111111111', '[]', false)$$,
  'enregistrable en lecture seule');

select * from finish();
rollback;
