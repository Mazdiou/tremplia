begin;
select plan(27);

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

-- Campagne A avec trois étapes, campagne A2 sans étape, campagne B
create temp table camp as
select
  public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
    'Campagne A', null, '{}', '[]', '[]', '{}', null,
    array['Constitution', 'Entretien', 'Visa']) as a,
  public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
    'Campagne A2', null, '{}', '[]', '[]', '{}') as a2,
  public.create_campaign(agency_b, '33333333-3333-3333-3333-333333333333',
    'Campagne B', null, '{}', '[]', '[]', '{}', null, array['Étape B']) as b
from ctx;
grant select on camp to public;

create function pg_temp.stage(p_name text) returns uuid language sql as $$
  select id from public.campaign_stages
  where campaign_id = (select a from camp) and name = p_name
$$;

create function pg_temp.stages_of() returns text language sql as $$
  select string_agg(name, ',' order by position)
  from public.campaign_stages where campaign_id = (select a from camp)
$$;

create function pg_temp.stage_of(p_case uuid) returns text language sql as $$
  select s.name from public.cases c
  join public.campaign_stages s on s.id = c.stage_id
  where c.id = p_case
$$;

select is(pg_temp.stages_of(), 'Constitution,Entretien,Visa',
  'la campagne est créée avec ses étapes, dans l''ordre');

select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Doublon', null, '{}', '[]', '[]', '{}',
      null, array['Visa', 'visa'])$$,
  '22023', null, 'deux étapes du même nom sont refusées à la création');

-- Dossiers : la première étape d'office
select public.create_case(v.id, agency_a, '11111111-1111-1111-1111-111111111111',
  v.campaign, null,
  jsonb_build_object('first_name', v.fn, 'last_name', 'Test', 'birth_date', '2004-05-01',
    'phone', '0555111111', 'education_level', 'l3'),
  null, null, null)
from ctx, camp,
  (values
    ('c1111111-cccc-cccc-cccc-cccccccccccc'::uuid, 'Un', (select a from camp)),
    ('c2222222-cccc-cccc-cccc-cccccccccccc'::uuid, 'Deux', (select a from camp)),
    ('c3333333-cccc-cccc-cccc-cccccccccccc'::uuid, 'Trois', (select a2 from camp))
  ) as v(id, fn, campaign);

select is(pg_temp.stage_of('c1111111-cccc-cccc-cccc-cccccccccccc'), 'Constitution',
  'un nouveau dossier commence à la première étape');
select is(
  (select stage_id from public.cases where id = 'c3333333-cccc-cccc-cccc-cccccccccccc'),
  null, 'un dossier d''une campagne sans étape n''en a pas');

-- Étape d'un dossier : tout membre actif
select is(
  public.set_case_stage('c1111111-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222', pg_temp.stage('Visa')),
  pg_temp.stage('Constitution'), 'un employé change l''étape (l''ancienne est renvoyée)');
select is(pg_temp.stage_of('c1111111-cccc-cccc-cccc-cccccccccccc'), 'Visa',
  'le dossier est à sa nouvelle étape');

select public.set_case_stage('c2222222-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', pg_temp.stage('Entretien'));

select throws_ok(
  $$select public.set_case_stage('c1111111-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      (select id from public.campaign_stages where campaign_id = (select b from camp)))$$,
  '23503', null, 'une étape d''une autre campagne est refusée');

select throws_ok(
  $$select public.set_case_stage('c1111111-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111', null)$$,
  '22023', null, 'un dossier ne revient pas « sans étape »');

select throws_ok(
  $$select public.set_case_stage('c1111111-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '55555555-5555-5555-5555-555555555555',
      pg_temp.stage('Entretien'))$$,
  '42501', null, 'un utilisateur désactivé ne change pas l''étape');

select throws_ok(
  $$select public.set_case_stage('c1111111-cccc-cccc-cccc-cccccccccccc',
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333',
      pg_temp.stage('Entretien'))$$,
  'P0002', null, 'une autre agence ne trouve pas le dossier');

-- Liste des étapes : patron seulement
select throws_ok(
  $$select public.replace_campaign_stages((select a from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', '[{"id": null, "name": "X"}]')$$,
  '42501', null, 'un employé ne modifie pas la liste des étapes');

select throws_ok(
  $$select public.replace_campaign_stages((select a from camp), (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333', '[{"id": null, "name": "X"}]')$$,
  'P0002', null, 'une autre agence ne modifie pas les étapes');

select throws_ok(
  $$select public.replace_campaign_stages((select a from camp), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111',
      jsonb_build_array(jsonb_build_object('id',
        (select id from public.campaign_stages where campaign_id = (select b from camp)),
        'name', 'Volée')))$$,
  '22023', null, 'une étape d''une autre campagne ne peut pas être reprise');

select throws_ok(
  $$select public.replace_campaign_stages((select a from camp), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111',
      '[{"id": null, "name": "A"}, {"id": null, "name": " a "}]')$$,
  '22023', null, 'deux étapes du même nom sont refusées');

select throws_ok(
  $$select public.replace_campaign_stages((select a from camp), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111',
      (select jsonb_agg(jsonb_build_object('id', null, 'name', 'E' || n))
       from generate_series(1, 16) as n))$$,
  '22023', null, 'la 16e étape est refusée');

-- Réorganisation : Visa en tête, Entretien renommé, Constitution retirée,
-- une étape ajoutée à la fin
select is(
  public.replace_campaign_stages((select a from camp), (select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111',
    jsonb_build_array(
      jsonb_build_object('id', pg_temp.stage('Visa'), 'name', 'Visa'),
      jsonb_build_object('id', pg_temp.stage('Entretien'), 'name', 'Entretien consulaire'),
      jsonb_build_object('id', null, 'name', 'Départ'))),
  0, 'aucun dossier n''était à l''étape retirée');
select is(pg_temp.stages_of(), 'Visa,Entretien consulaire,Départ',
  'les étapes sont réordonnées, renommées et complétées');
select is(pg_temp.stage_of('c2222222-cccc-cccc-cccc-cccccccccccc'), 'Entretien consulaire',
  'un dossier suit son étape renommée');

-- Retrait de l'étape d'un dossier : il recule à l'étape gardée précédente
select is(
  public.replace_campaign_stages((select a from camp), (select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111',
    jsonb_build_array(
      jsonb_build_object('id', pg_temp.stage('Visa'), 'name', 'Visa'),
      jsonb_build_object('id', pg_temp.stage('Départ'), 'name', 'Départ'))),
  1, 'le dossier de l''étape retirée est déplacé');
select is(pg_temp.stage_of('c2222222-cccc-cccc-cccc-cccccccccccc'), 'Visa',
  'il recule à l''étape gardée qui précédait');

-- Retrait de la première étape : ses dossiers passent à la nouvelle première
select public.replace_campaign_stages((select a from camp), (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111',
  jsonb_build_array(jsonb_build_object('id', pg_temp.stage('Départ'), 'name', 'Départ')));
select is(
  (select count(*) from public.cases
    where campaign_id = (select a from camp) and stage_id = pg_temp.stage('Départ')),
  2::bigint, 'sans étape précédente, les dossiers vont à la première');

-- Campagne sans étape qui en reçoit : ses dossiers vont à la première
select is(
  public.replace_campaign_stages((select a2 from camp), (select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111', '[{"id": null, "name": "Début"}]'),
  1, 'les dossiers sans étape passent à la première');

-- Campagne archivée : liste figée, étape d'un dossier modifiable
select public.set_campaign_status((select a from camp), (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', 'archived');
select throws_ok(
  $$select public.replace_campaign_stages((select a from camp), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', '[{"id": null, "name": "X"}]')$$,
  '55000', null, 'les étapes d''une campagne archivée sont figées');
select lives_ok(
  $$select public.set_case_stage('c1111111-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      pg_temp.stage('Départ'))$$,
  'l''étape d''un dossier change encore dans une campagne archivée');

-- Lecture (RLS) : employé A1
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.campaign_stages), 2::bigint,
  'un membre lit les étapes de son agence');

select throws_ok(
  $$update public.campaign_stages set name = 'Directe'$$,
  '42501', null, 'aucune écriture directe sans passer par les fonctions');

-- Patron B
reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.campaign_stages where campaign_id = (select a from camp)),
  0::bigint, 'une autre agence ne voit pas les étapes');

select * from finish();
rollback;
