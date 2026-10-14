begin;
select plan(5);

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


-- Deuxième dossier en A (M1, abandonné), un dossier en B
select public.create_case('dddddddd-dddd-dddd-dddd-dddddddddddd', agency_a,
  '11111111-1111-1111-1111-111111111111',
  (select campaign_id from public.cases where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  '22222222-2222-2222-2222-222222222222',
  '{"first_name": "Lina", "last_name": "A-case", "birth_date": "2003-02-01",
    "phone": "0555222222", "education_level": "m1"}',
  null, null, null)
from ctx;
select public.set_case_status('dddddddd-dddd-dddd-dddd-dddddddddddd',
  (select agency_a from ctx), '11111111-1111-1111-1111-111111111111', 'abandoned');

select public.create_case('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', agency_b,
  '33333333-3333-3333-3333-333333333333',
  public.create_campaign(agency_b, '33333333-3333-3333-3333-333333333333',
    'Campagne B', null, '{}', '[]', '[]', '{}'),
  null,
  '{"first_name": "Omar", "last_name": "B-case", "birth_date": "2004-05-01",
    "phone": "0555333333", "education_level": "l3"}',
  null, null, null)
from ctx;

-- Employé A1
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select sum(cases) from public.case_stats), 2::bigint,
  'une agence ne compte que ses propres dossiers');
select is(
  (select sum(cases) from public.case_stats where status = 'active' and education_level = 'l3'),
  1::bigint, 'les dossiers sont comptés par statut et par niveau');
select is(
  (select sum(cases) from public.case_stats
    where assigned_to = '22222222-2222-2222-2222-222222222222'),
  1::bigint, 'et par responsable');
select is((select sum(created_last_week) from public.case_stats), 2::bigint,
  'les dossiers de la semaine sont comptés');

select ok(not has_table_privilege('authenticated', 'public.case_stats', 'INSERT, UPDATE, DELETE'),
  'la vue est en lecture seule');

select * from finish();
rollback;
