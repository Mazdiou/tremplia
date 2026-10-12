begin;
select plan(19);

-- Données de test : agence A (patron a1, employé a2), agence B (patron b1)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a2@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');
select public.create_agency_with_owner(
  '33333333-3333-3333-3333-333333333333', 'Agence B', 'Oran', '0555000002', 'Patron', 'B');

insert into public.profiles (id, agency_id, first_name, last_name, role)
select '22222222-2222-2222-2222-222222222222', agency_id, 'Employe', 'A', 'employee'
from public.profiles where id = '11111111-1111-1111-1111-111111111111';

create temp table ctx as
select
  (select agency_id from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') as agency_a,
  (select agency_id from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') as agency_b,
  (select id from public.campaigns where is_current) as campaign;

-- Un dossier par agence
insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
  birth_date, phone, education_level, main_track, scope, pastel_account)
select agency_a, campaign, '11111111-1111-1111-1111-111111111111',
  'Karim', 'A-case', '2004-05-01', '0555111111', 'l3', 'non_dap', 'both', 'to_create'
from ctx;

insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
  birth_date, phone, education_level, main_track, scope, pastel_account)
select agency_b, campaign, '33333333-3333-3333-3333-333333333333',
  'Sara', 'B-case', '2005-02-10', '0555222222', 'l1', 'dap', 'application', 'to_create'
from ctx;

-- Patron A
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.cases), 1::bigint,
  'patron A ne voit que le dossier de son agence');

select is((select count(*) from public.cases where last_name = 'B-case'), 0::bigint,
  'patron A ne voit pas le dossier de l''agence B');

select throws_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, schools, scope, pastel_account)
    values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'X', 'Y',
      '2004-01-01', '0555', 'l3', true, 'both', 'to_create')$$,
  '42501', null, 'un utilisateur connecté ne peut pas créer de dossier directement');

select throws_ok(
  $$update public.cases set phone = '000'$$,
  '42501', null, 'un utilisateur connecté ne peut pas modifier un dossier directement');

select throws_ok(
  $$delete from public.cases$$,
  '42501', null, 'un utilisateur connecté ne peut pas supprimer un dossier');

-- Employé A
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.cases), 1::bigint,
  'un employé voit les dossiers de son agence');

select throws_ok(
  $$delete from public.cases$$,
  '42501', null, 'un employé ne peut pas supprimer un dossier');

-- Patron B
reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.cases where last_name = 'A-case'), 0::bigint,
  'patron B ne voit pas le dossier de l''agence A');

-- Visiteur non connecté
reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.cases$$,
  '42501', null, 'un visiteur non connecté ne peut pas lire les dossiers');

-- Contraintes de la table (avec les droits d'administrateur)
reset role;

select throws_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, main_track, schools, scope, pastel_account)
    select agency_a, campaign, '11111111-1111-1111-1111-111111111111', 'X', 'Y',
      '2004-01-01', '0555', 'l3', null, false, 'both', 'to_create' from ctx$$,
  '23514', null, 'un dossier sans procédure ni écoles est refusé');

select throws_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, main_track, scope, pastel_account, pastel_email)
    select agency_a, campaign, '11111111-1111-1111-1111-111111111111', 'X', 'Y',
      '2004-01-01', '0555', 'l3', 'dap', 'both', 'existing', null from ctx$$,
  '23514', null, 'un compte Pastel existant sans e-mail est refusé');

select throws_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, main_track, scope, pastel_account)
    select agency_a, campaign, '11111111-1111-1111-1111-111111111111', 'X', 'Y',
      '2004-01-01', '0555', 'doctorat', 'dap', 'both', 'to_create' from ctx$$,
  '23514', null, 'un niveau d''études inconnu est refusé');

select throws_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, main_track, scope, pastel_account, diplomas)
    select agency_a, campaign, '11111111-1111-1111-1111-111111111111', 'X', 'Y',
      '2004-01-01', '0555', 'l3', 'dap', 'both', 'to_create',
      array['bac', 'doctorat'] from ctx$$,
  '23514', null, 'un diplôme inconnu est refusé');

select lives_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, main_track, scope, pastel_account, diplomas,
      language_tests)
    select agency_a, campaign, '11111111-1111-1111-1111-111111111111', 'Trois', 'Diplomes',
      '1998-01-01', '0555', 'm2', 'non_dap', 'both', 'to_create',
      array['bac', 'licence', 'master'], array['fr', 'en'] from ctx$$,
  'un candidat peut avoir les trois diplômes et les deux tests');

select lives_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, main_track, scope, pastel_account)
    select agency_a, campaign, '11111111-1111-1111-1111-111111111111', 'Aucun', 'Diplome',
      '2008-01-01', '0555', 'terminale', 'dap', 'application', 'to_create' from ctx$$,
  'un candidat peut n''avoir aucun diplôme');

select throws_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, main_track, scope, pastel_account)
    select agency_a, campaign, '33333333-3333-3333-3333-333333333333', 'X', 'Y',
      '2004-01-01', '0555', 'l3', 'dap', 'both', 'to_create' from ctx$$,
  '23503', null, 'le créateur d''un dossier doit appartenir à la même agence');

select throws_ok(
  $$update public.cases set agency_id = (select agency_b from ctx)
    where last_name = 'A-case'$$,
  '42501', null, 'l''agence d''un dossier n''est pas modifiable');

select throws_ok(
  $$update public.cases set created_by = '22222222-2222-2222-2222-222222222222'
    where last_name = 'A-case'$$,
  '42501', null, 'le créateur d''un dossier n''est pas modifiable');

select lives_ok(
  $$update public.cases set phone = '0666000000' where last_name = 'A-case'$$,
  'une modification ordinaire reste possible');

select * from finish();
rollback;