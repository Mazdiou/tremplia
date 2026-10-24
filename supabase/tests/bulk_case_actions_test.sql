begin;
select plan(18);

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

-- Campagne A (deux étapes), campagne A2 (une étape), campagne B
create temp table camp as
select
  public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
    'Campagne A', null, '{}', '[]', '[]', '{}', null,
    array['Constitution', 'Entretien']) as a,
  public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
    'Campagne A2', null, '{}', '[]', '[]', '{}', null, array['Autre']) as a2,
  public.create_campaign(agency_b, '33333333-3333-3333-3333-333333333333',
    'Campagne B', null, '{}', '[]', '[]', '{}', null, array['Étape B']) as b
from ctx;
grant select on camp to public;

-- Étape d'une campagne de test (l'agence a peut-être d'autres campagnes)
create function pg_temp.stage(p_name text) returns uuid language sql as $$
  select id from public.campaign_stages
  where name = p_name and campaign_id in (select a from camp union select a2 from camp)
$$;

create function pg_temp.stage_of(p_case uuid) returns text language sql as $$
  select s.name from public.cases c
  join public.campaign_stages s on s.id = c.stage_id
  where c.id = p_case
$$;

create function pg_temp.assignee_of(p_case uuid) returns uuid language sql as $$
  select assigned_to from public.cases where id = p_case
$$;

-- Un, Deux : campagne A ; Trois : campagne A2 ; Quatre : agence B
select public.create_case(v.id, v.agency, v.actor, v.campaign, null,
  jsonb_build_object('first_name', v.fn, 'last_name', 'Test', 'birth_date', '2004-05-01',
    'phone', '0555111111', 'education_level', 'l3'),
  null, null, null)
from ctx, camp,
  (values
    ('c1111111-cccc-cccc-cccc-cccccccccccc'::uuid, 'Un', (select a from camp),
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid),
    ('c2222222-cccc-cccc-cccc-cccccccccccc'::uuid, 'Deux', (select a from camp),
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid),
    ('c3333333-cccc-cccc-cccc-cccccccccccc'::uuid, 'Trois', (select a2 from camp),
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid),
    ('c4444444-cccc-cccc-cccc-cccccccccccc'::uuid, 'Quatre', (select b from camp),
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333'::uuid)
  ) as v(id, fn, campaign, agency, actor);

-- Étape : tout membre actif, tout ou rien

select is(
  (select count(*) from public.set_cases_stage(
    array['c1111111-cccc-cccc-cccc-cccccccccccc',
          'c2222222-cccc-cccc-cccc-cccccccccccc',
          'c1111111-cccc-cccc-cccc-cccccccccccc']::uuid[],
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    pg_temp.stage('Entretien'))),
  2::bigint, 'un employé change l''étape de deux dossiers (doublon ignoré)');
select is(pg_temp.stage_of('c2222222-cccc-cccc-cccc-cccccccccccc'), 'Entretien',
  'les dossiers sont à leur nouvelle étape');

select is(
  (select previous_stage_id from public.set_cases_stage(
    array['c1111111-cccc-cccc-cccc-cccccccccccc']::uuid[],
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    pg_temp.stage('Constitution'))),
  pg_temp.stage('Entretien'), 'l''ancienne étape de chaque dossier changé est renvoyée');

select is(
  (select count(*) from public.set_cases_stage(
    array['c1111111-cccc-cccc-cccc-cccccccccccc',
          'c2222222-cccc-cccc-cccc-cccccccccccc']::uuid[],
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    pg_temp.stage('Entretien'))),
  1::bigint, 'un dossier déjà à cette étape n''est pas compté');

select throws_ok(
  $$select * from public.set_cases_stage(
      array['c1111111-cccc-cccc-cccc-cccccccccccc',
            'c3333333-cccc-cccc-cccc-cccccccccccc']::uuid[],
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      pg_temp.stage('Constitution'))$$,
  '23503', null, 'une étape d''une autre campagne est refusée pour toute la sélection');
select is(pg_temp.stage_of('c1111111-cccc-cccc-cccc-cccccccccccc'), 'Entretien',
  'refus : aucun dossier n''a changé');

select throws_ok(
  $$select * from public.set_cases_stage(
      array['c1111111-cccc-cccc-cccc-cccccccccccc',
            'c4444444-cccc-cccc-cccc-cccccccccccc']::uuid[],
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      pg_temp.stage('Constitution'))$$,
  'P0002', null, 'un dossier d''une autre agence fait tout refuser');

select throws_ok(
  $$select * from public.set_cases_stage('{}', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', pg_temp.stage('Constitution'))$$,
  '22023', null, 'une sélection vide est refusée');

select throws_ok(
  $$select * from public.set_cases_stage(
      array(select gen_random_uuid() from generate_series(1, 201)),
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      pg_temp.stage('Constitution'))$$,
  '22023', null, 'plus de 200 dossiers d''un coup sont refusés');

select throws_ok(
  $$select * from public.set_cases_stage(
      array['c1111111-cccc-cccc-cccc-cccccccccccc']::uuid[],
      (select agency_a from ctx), '55555555-5555-5555-5555-555555555555',
      pg_temp.stage('Constitution'))$$,
  '42501', null, 'un utilisateur désactivé ne change pas l''étape');

-- Responsable : patron seulement

select throws_ok(
  $$select * from public.set_cases_assignee(
      array['c1111111-cccc-cccc-cccc-cccccccccccc']::uuid[],
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'un employé ne change pas le responsable');

select is(
  (select count(*) from public.set_cases_assignee(
    array['c1111111-cccc-cccc-cccc-cccccccccccc',
          'c2222222-cccc-cccc-cccc-cccccccccccc',
          'c3333333-cccc-cccc-cccc-cccccccccccc']::uuid[],
    (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222')),
  3::bigint, 'le patron confie trois dossiers de campagnes différentes');
select is(pg_temp.assignee_of('c3333333-cccc-cccc-cccc-cccccccccccc'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'les dossiers ont leur nouveau responsable');

select is(
  (select previous_assignee from public.set_cases_assignee(
    array['c1111111-cccc-cccc-cccc-cccccccccccc']::uuid[],
    (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111')),
  '22222222-2222-2222-2222-222222222222'::uuid, 'l''ancien responsable est renvoyé');

select throws_ok(
  $$select * from public.set_cases_assignee(
      array['c1111111-cccc-cccc-cccc-cccccccccccc']::uuid[],
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      '55555555-5555-5555-5555-555555555555')$$,
  '22023', null, 'un membre désactivé ne devient pas responsable');

select throws_ok(
  $$select * from public.set_cases_assignee(
      array['c1111111-cccc-cccc-cccc-cccccccccccc']::uuid[],
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      '33333333-3333-3333-3333-333333333333')$$,
  '22023', null, 'un membre d''une autre agence ne devient pas responsable');

select throws_ok(
  $$select * from public.set_cases_assignee(
      array['c2222222-cccc-cccc-cccc-cccccccccccc',
            'c4444444-cccc-cccc-cccc-cccccccccccc']::uuid[],
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      '11111111-1111-1111-1111-111111111111')$$,
  'P0002', null, 'un dossier d''une autre agence fait tout refuser');
select is(pg_temp.assignee_of('c2222222-cccc-cccc-cccc-cccccccccccc'),
  '22222222-2222-2222-2222-222222222222'::uuid, 'refus : aucun responsable n''a changé');

select * from finish();
rollback;
