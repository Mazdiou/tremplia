begin;
select plan(11);

-- Agence A : patron P, employé E. Agence B : patron Q. Dossier 1 et 2 dans A.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'p@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'e@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'q@test.local');

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');
select public.create_agency_with_owner(
  '33333333-3333-3333-3333-333333333333', 'Agence B', 'Oran', '0555000002', 'Patron', 'B');

insert into public.profiles (id, agency_id, first_name, last_name, role, is_active)
select '22222222-2222-2222-2222-222222222222', agency_id, 'Employe', 'A', 'employee', true
from public.profiles where id = '11111111-1111-1111-1111-111111111111';

create temp table ctx as
select (select agency_id from public.profiles where id = '11111111-1111-1111-1111-111111111111') as a;
grant select on ctx to public;

create temp table camp as
select public.create_campaign(a, '11111111-1111-1111-1111-111111111111',
  'Campagne A', null, '{}', '[]', '[]', '{}') as id
from ctx;
grant select on camp to public;

select public.create_case(v.id, ctx.a, '11111111-1111-1111-1111-111111111111', (select id from camp),
  null, format('{"first_name": "%s", "last_name": "C", "birth_date": "2004-05-01",
    "phone": "0555111111", "education_level": "l3"}', v.fn)::jsonb, null, null, null)
from ctx, (values
  ('c1111111-1111-1111-1111-111111111111'::uuid, 'Un'),
  ('c2222222-2222-2222-2222-222222222222'::uuid, 'Deux')
) as v(id, fn);

-- Point de départ connu : création il y a 30 jours, aucune action
delete from public.case_last_activity
where case_id in ('c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222');
-- (date de création protégée : déclencheurs coupés le temps de la vieillir)
set local session_replication_role = replica;
update public.cases set created_at = now() - interval '30 days'
where id in ('c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222');
set local session_replication_role = origin;

create function pg_temp.last(p_case uuid)
returns timestamptz language sql as $$
  select last_activity_at from public.case_activity where id = p_case
$$;

select ok(pg_temp.last('c1111111-1111-1111-1111-111111111111') < now() - interval '29 days',
  'sans action : la date de création');

-- Action d'un membre : le dossier est à jour
insert into public.activity_log (agency_id, actor_id, action, case_id)
values ((select a from ctx), '22222222-2222-2222-2222-222222222222', 'case.updated',
  'c1111111-1111-1111-1111-111111111111');
select ok(pg_temp.last('c1111111-1111-1111-1111-111111111111') > now() - interval '1 minute',
  'action d''un membre : date mise à jour');
select ok(pg_temp.last('c2222222-2222-2222-2222-222222222222') < now() - interval '29 days',
  'l''autre dossier ne bouge pas');

-- Action du candidat (sans auteur) : ne compte pas
insert into public.activity_log (agency_id, actor_id, action, case_id)
values ((select a from ctx), null, 'student.message_sent', 'c2222222-2222-2222-2222-222222222222');
select ok(pg_temp.last('c2222222-2222-2222-2222-222222222222') < now() - interval '29 days',
  'action du candidat : ne compte pas');

-- Ligne plus ancienne écrite après : la date ne recule pas
insert into public.activity_log (agency_id, actor_id, action, case_id, created_at)
values ((select a from ctx), '22222222-2222-2222-2222-222222222222', 'case.updated',
  'c1111111-1111-1111-1111-111111111111', now() - interval '20 days');
select ok(pg_temp.last('c1111111-1111-1111-1111-111111111111') > now() - interval '1 minute',
  'la date ne recule jamais');
select is(
  (select count(*) from public.case_last_activity
   where case_id = 'c1111111-1111-1111-1111-111111111111'),
  1::bigint, 'une seule ligne par dossier');

-- Droits : lecture par l'agence seulement, aucune écriture
select ok(not has_table_privilege('anon', 'public.case_last_activity', 'select'),
  'anon ne lit pas');
select ok(not has_table_privilege('authenticated', 'public.case_last_activity', 'insert'),
  'personne n''écrit directement');

set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
select is(
  (select count(*) from public.case_activity where campaign_id = (select id from camp)),
  2::bigint, 'un employé de l''agence lit ses dossiers');
select ok(pg_temp.last('c1111111-1111-1111-1111-111111111111') is not null,
  'avec la date de dernière action');

select set_config('request.jwt.claims',
  '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}', true);
select is(
  (select count(*) from public.case_last_activity
   where case_id = 'c1111111-1111-1111-1111-111111111111'),
  0::bigint, 'une autre agence ne voit rien');
reset role;

select * from finish();
rollback;
