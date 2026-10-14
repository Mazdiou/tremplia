begin;
select plan(20);

-- Patron A, employé A1, employé désactivé A3, patron B
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'a3@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b0@test.local');

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');
select public.create_agency_with_owner(
  '33333333-3333-3333-3333-333333333333', 'Agence B', 'Oran', '0555000002', 'Patron', 'B');

insert into public.profiles (id, agency_id, first_name, last_name, role, is_active)
select v.id, p.agency_id, v.fn, 'A', 'employee', v.active
from public.profiles p,
  (values
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Employe1', true),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'Employe3', false)
  ) as v(id, fn, active)
where p.id = '11111111-1111-1111-1111-111111111111';

create temp table ctx as
select
  (select agency_id from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') as agency_a,
  (select agency_id from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') as agency_b;
grant select on ctx to public;

select public.create_case('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '11111111-1111-1111-1111-111111111111',
  public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
    'Campagne A', null, '{}', '[]', '[]', '{}'),
  null,
  '{"first_name": "Karim", "last_name": "A-case", "birth_date": "2004-05-01",
    "phone": "0555111111", "education_level": "l3"}',
  null, null, null)
from ctx;


-- Empreintes factices (64 caractères hexadécimaux)
create function pg_temp.h(c text) returns text language sql as $$ select repeat(c, 64) $$;
create function pg_temp.login(code text, ip text default '1')
returns table (case_id uuid, agency_id uuid, generation integer)
language sql as $$ select * from public.student_login(pg_temp.h(code), pg_temp.h(ip)) $$;

-- Fermé tant que l'agence n'a rien activé
select is((select count(*) from pg_temp.login('a')), 0::bigint,
  'aucun accès avant la première activation');

select is(
  public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    pg_temp.h('a'), 'chiffre-a', 1::smallint),
  true, 'un employé active l''accès (le code est créé)');

select is(
  public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    pg_temp.h('b'), 'chiffre-b', 1::smallint),
  false, 'une deuxième activation ne change rien');

select is((select code_lookup from public.case_student_access
  where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), pg_temp.h('a'),
  'le premier code est gardé');

select is((select generation from pg_temp.login('a')), 1,
  'le bon code ouvre l''espace du candidat');

select is((select count(*) from pg_temp.login('b')), 0::bigint,
  'un mauvais code est refusé');

-- Désactivation
select is(
  public.disable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'),
  true, 'le patron désactive l''accès');
select is((select count(*) from pg_temp.login('a')), 0::bigint,
  'un accès désactivé est refusé');
select is((select generation from public.case_student_access
  where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 2,
  'la désactivation ferme les sessions ouvertes');

select is(
  public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    pg_temp.h('c'), 'chiffre-c', 1::smallint),
  true, 'l''accès est réactivé avec le même code');
select is((select generation from pg_temp.login('a')), 2,
  'le code d''origine fonctionne de nouveau');

-- Nouveau code
select lives_ok(
  $$select public.regenerate_student_code('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      pg_temp.h('d'), 'chiffre-d', 1::smallint)$$,
  'un employé crée un nouveau code');
select is((select count(*) from pg_temp.login('a')), 0::bigint,
  'l''ancien code ne fonctionne plus');
select is((select generation from pg_temp.login('d')), 3,
  'le nouveau code fonctionne, avec une nouvelle génération');

-- Dossier abandonné
select public.set_case_status('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '11111111-1111-1111-1111-111111111111', 'abandoned');
select is((select count(*) from pg_temp.login('d')), 0::bigint,
  'un dossier abandonné ferme l''accès');
select public.set_case_status('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '11111111-1111-1111-1111-111111111111', 'active');

-- Droits
select throws_ok(
  $$select public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '55555555-5555-5555-5555-555555555555',
      pg_temp.h('e'), 'x', 1::smallint)$$,
  '42501', null, 'un utilisateur désactivé ne gère pas l''accès');

select throws_ok(
  $$select public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333',
      pg_temp.h('e'), 'x', 1::smallint)$$,
  'P0002', null, 'une autre agence ne trouve pas le dossier');

-- Limite d'essais : 10 échecs par adresse sur 15 minutes
select pg_temp.login('f', '9') from generate_series(1, 9);
select is((select generation from pg_temp.login('d', '9')), 3,
  'après quelques échecs, le bon code fonctionne encore');
select pg_temp.login('f', '9');
select throws_ok($$select * from pg_temp.login('d', '9')$$,
  '54000', null, 'au-delà de 10 échecs, même le bon code est bloqué');

-- Aucune lecture directe
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select throws_ok($$select count(*) from public.case_student_access$$,
  '42501', null, 'un membre ne lit pas les codes directement');

select * from finish();
rollback;
