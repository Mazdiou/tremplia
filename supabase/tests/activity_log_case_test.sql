begin;
select plan(3);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

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

select public.create_case(
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
  (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111'::uuid,
  null::uuid,
  'Karim', 'Test', '2004-05-01'::date, '0555111111', null,
  'l3', 'non_dap', false, 'both', 'to_create', null,
  array[]::text[], array[]::text[], null, 1::smallint);

select lives_ok(
  $$insert into public.activity_log (agency_id, actor_id, action, case_id)
    values ((select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
            'case.created', 'bbbbbbbb-0000-0000-0000-000000000001')$$,
  'une ligne de journal peut être rattachée à un dossier de la même agence');

select throws_ok(
  $$insert into public.activity_log (agency_id, actor_id, action, case_id)
    values ((select agency_b from ctx), '33333333-3333-3333-3333-333333333333',
            'case.created', 'bbbbbbbb-0000-0000-0000-000000000001')$$,
  '23503', null,
  'une ligne de journal ne peut pas pointer vers le dossier d''une autre agence');

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$insert into public.activity_log (agency_id, action, case_id)
    values (gen_random_uuid(), 'x', gen_random_uuid())$$,
  '42501', null, 'un utilisateur connecté ne peut toujours pas écrire dans le journal');

select * from finish();
rollback;