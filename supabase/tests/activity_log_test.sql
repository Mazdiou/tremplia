begin;
select plan(14);

-- Agence A : patron (1111), employé (2222) ; agence B : patron (3333)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b0@test.local');

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');
select public.create_agency_with_owner(
  '33333333-3333-3333-3333-333333333333', 'Agence B', 'Oran', '0555000002', 'Patron', 'B');

create temp table ctx as
select
  (select agency_id from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') as agency_a,
  (select agency_id from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') as agency_b;
grant select on ctx to public;

select public.add_employee((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 'Employe', 'A');

select public.create_case('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '11111111-1111-1111-1111-111111111111',
  public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
    'Campagne A', null, '{}', '[]', '[]', '{}'),
  null,
  '{"first_name": "Karim", "last_name": "Test", "birth_date": "2004-05-01",
    "phone": "0555111111", "education_level": "l3"}',
  null, null, null)
from ctx;

-- Écriture par le serveur

set local role service_role;

select lives_ok(
  $$insert into public.activity_log (agency_id, actor_id, action, target_type, target_id, case_id)
    select agency_a, '11111111-1111-1111-1111-111111111111', 'case.created', 'case',
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    from ctx$$,
  'le serveur rattache une ligne de journal à un dossier de la même agence');
select lives_ok(
  $$insert into public.activity_log (agency_id, actor_id, action)
    select agency_b, '33333333-3333-3333-3333-333333333333', 'agency.created' from ctx$$,
  'le serveur écrit dans le journal de l''agence B');
select throws_ok(
  $$insert into public.activity_log (agency_id, actor_id, action, case_id)
    select agency_b, '33333333-3333-3333-3333-333333333333', 'case.created',
      'cccccccc-cccc-cccc-cccc-cccccccccccc' from ctx$$,
  '23503', null, 'une ligne de journal ne pointe pas vers le dossier d''une autre agence');
select throws_ok(
  $$insert into public.activity_log (agency_id, action)
    select agency_a, 'Dossier créé pour Sara' from ctx$$,
  '23514', null, 'une action est un code (domaine.action), jamais une phrase libre');
select throws_ok(
  $$insert into public.activity_log (agency_id, action, details)
    select agency_a, 'case.updated', '["phone"]' from ctx$$,
  '23514', null, 'les détails sont toujours un objet');
select throws_ok(
  $$update public.activity_log set action = 'case.updated'$$,
  '42501', null, 'même le serveur ne modifie pas le journal');
select throws_ok(
  $$delete from public.activity_log$$,
  '42501', null, 'même le serveur ne supprime rien du journal');

-- Patron A

reset role;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.activity_log), 1::bigint,
  'le patron A ne voit que le journal de son agence');
select is(
  (select count(*) from public.activity_log
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  1::bigint, 'le patron A lit l''historique d''un dossier');
select throws_ok(
  $$insert into public.activity_log (agency_id, action)
    values (gen_random_uuid(), 'case.created')$$,
  '42501', null, 'un utilisateur connecté n''écrit pas dans le journal');
select throws_ok(
  $$update public.activity_log set action = 'case.updated'$$,
  '42501', null, 'un utilisateur connecté ne modifie pas le journal');
select throws_ok(
  $$delete from public.activity_log$$,
  '42501', null, 'un utilisateur connecté ne supprime rien du journal');

-- Employé A

reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.activity_log), 0::bigint,
  'un employé ne voit rien du journal');

-- Visiteur

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.activity_log$$,
  '42501', null, 'un visiteur ne lit pas le journal');

select * from finish();
rollback;
