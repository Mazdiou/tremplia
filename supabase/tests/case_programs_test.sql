begin;
select plan(19);

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


-- Écriture : trois formations ajoutées dans l'ordre
create temp table p as
select
  public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
    '22222222-2222-2222-2222-222222222222', 'Licence Informatique', 'l3', 'Lyon',
    'Université Lyon 1') as p1,
  public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
    '11111111-1111-1111-1111-111111111111', 'Licence MIASHS', 'l3', 'Grenoble', null) as p2,
  public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
    '22222222-2222-2222-2222-222222222222', 'BUT Informatique', 'but', 'Montpellier', null) as p3
from ctx;
grant select on p to public;

create function pg_temp.order_of() returns text language sql as $$
  select string_agg(city, ',' order by position)
  from public.case_programs
  where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
$$;

select is(pg_temp.order_of(), 'Lyon,Grenoble,Montpellier',
  'les formations sont ajoutées en fin de liste');

select is(
  public.move_case_program((select p3 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', -1),
  true, 'une formation monte d''un rang');
select is(pg_temp.order_of(), 'Lyon,Montpellier,Grenoble', 'le rang est échangé avec la voisine');

select is(
  public.move_case_program((select p1 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', -1),
  false, 'la première formation ne monte pas plus haut');

select throws_ok(
  $$select public.move_case_program((select p1 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 2)$$,
  '22023', null, 'seuls -1 et +1 sont acceptés');

select is(
  public.update_case_program((select p2 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    'Licence MIASHS', 'l2', 'Grenoble', 'UGA'),
  true, 'un employé modifie une formation');

select is(
  public.update_case_program((select p2 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    'Licence MIASHS', 'l2', 'Grenoble', 'UGA'),
  false, 'une modification identique ne change rien');

select lives_ok(
  $$select public.delete_case_program((select p1 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111')$$,
  'le patron supprime une formation');
select is(
  (select string_agg(position::text, ',' order by position) from public.case_programs
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  '1,2', 'les rangs restent sans trou après une suppression');

-- Contrôles
select throws_ok(
  $$select public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', ' ', 'l3', 'Lyon', null)$$,
  '23514', null, 'un intitulé vide est refusé');

select throws_ok(
  $$select public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'X', 'bac', 'Lyon', null)$$,
  '23514', null, 'un niveau inconnu est refusé');

select lives_ok(
  $$select public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'F' || n, 'm1', 'Paris', null)
    from generate_series(1, 18) as n$$,
  'jusqu''à 20 formations par dossier');

select throws_ok(
  $$select public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'F21', 'm1', 'Paris', null)$$,
  '54000', null, 'la 21e formation est refusée');

select throws_ok(
  $$select public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '55555555-5555-5555-5555-555555555555', 'X', 'l3', 'Lyon', null)$$,
  '42501', null, 'un utilisateur désactivé ne peut pas écrire');

select throws_ok(
  $$select public.delete_case_program((select p2 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333')$$,
  'P0002', null, 'une autre agence ne supprime pas la formation');

select throws_ok(
  $$select public.update_case_program((select p1 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'X', 'l3', 'Lyon', null)$$,
  'P0002', null, 'une formation supprimée est introuvable');

-- Lecture (RLS) : employé A1
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.case_programs), 20::bigint,
  'un membre de l''agence lit les formations');

select throws_ok(
  $$update public.case_programs set city = 'Directe'$$,
  '42501', null, 'aucune écriture directe sans passer par les fonctions');

-- Patron B
reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.case_programs), 0::bigint,
  'une autre agence ne voit pas les formations');

select * from finish();
rollback;
