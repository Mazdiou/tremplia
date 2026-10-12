begin;
select plan(16);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a2@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'a3@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');
select public.create_agency_with_owner(
  '33333333-3333-3333-3333-333333333333', 'Agence B', 'Oran', '0555000002', 'Patron', 'B');

-- a3 : employé désactivé de l'agence A
insert into public.profiles (id, agency_id, first_name, last_name, role, is_active)
select '44444444-4444-4444-4444-444444444444', agency_id, 'Ancien', 'A', 'employee', false
from public.profiles where id = '11111111-1111-1111-1111-111111111111';

create temp table ctx as
select
  (select agency_id from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') as agency_a,
  (select agency_id from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') as agency_b,
  (select id from public.campaigns where is_current) as campaign;

-- 0001 : compte à créer ; 0003 : compte à créer (tests d'échec)
insert into public.cases (id, agency_id, campaign_id, created_by, first_name, last_name,
  birth_date, phone, education_level, main_track, scope, pastel_account)
select 'aaaaaaaa-0000-0000-0000-000000000001', agency_a, campaign,
  '11111111-1111-1111-1111-111111111111', 'Un', 'Test', '2004-05-01', '0555111111',
  'l3', 'dap', 'both', 'to_create'
from ctx;

insert into public.cases (id, agency_id, campaign_id, created_by, first_name, last_name,
  birth_date, phone, education_level, main_track, scope, pastel_account)
select 'aaaaaaaa-0000-0000-0000-000000000003', agency_a, campaign,
  '11111111-1111-1111-1111-111111111111', 'Trois', 'Test', '2004-05-01', '0555333333',
  'l3', 'dap', 'both', 'to_create'
from ctx;

-- 0002 : compte existant avec mot de passe déjà enregistré
insert into public.cases (id, agency_id, campaign_id, created_by, first_name, last_name,
  birth_date, phone, education_level, main_track, scope, pastel_account, pastel_email)
select 'aaaaaaaa-0000-0000-0000-000000000002', agency_a, campaign,
  '11111111-1111-1111-1111-111111111111', 'Deux', 'Test', '2004-05-01', '0555222222',
  'l3', 'dap', 'both', 'existing', 'old@example.com'
from ctx;

insert into public.case_pastel_credentials (case_id, agency_id, password_encrypted)
select 'aaaaaaaa-0000-0000-0000-000000000002', agency_a, 'old' from ctx;

-- Compte à créer -> existant, avec e-mail et mot de passe
select lives_ok(
  $$select public.set_pastel_credentials(
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid, (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid,
      'karim@example.com', 'chiffre-1', 1::smallint)$$,
  'un compte à créer peut être renseigné (e-mail et mot de passe)');

select is(
  (select pastel_account from public.cases
   where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'existing', 'le dossier passe à compte existant');

select is(
  (select count(*) from public.case_pastel_credentials
   where case_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  1::bigint, 'le mot de passe chiffré est enregistré');

-- Compte existant : e-mail seul, le mot de passe est conservé
select lives_ok(
  $$select public.set_pastel_credentials(
      'aaaaaaaa-0000-0000-0000-000000000002'::uuid, (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid,
      'new@example.com', null::text, 1::smallint)$$,
  'l''e-mail seul peut être modifié sur un compte existant');

select is(
  (select pastel_email from public.cases
   where id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'new@example.com', 'l''e-mail est modifié');

select is(
  (select password_encrypted from public.case_pastel_credentials
   where case_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'old', 'le mot de passe existant est conservé');

-- Compte existant : changement de mot de passe
select lives_ok(
  $$select public.set_pastel_credentials(
      'aaaaaaaa-0000-0000-0000-000000000002'::uuid, (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid,
      'new@example.com', 'nouveau', 1::smallint)$$,
  'le mot de passe peut être remplacé');

select is(
  (select password_encrypted from public.case_pastel_credentials
   where case_id = 'aaaaaaaa-0000-0000-0000-000000000002'),
  'nouveau', 'le nouveau mot de passe chiffré est enregistré');

-- Compte à créer sans mot de passe : refusé, et rien ne change
select throws_ok(
  $$select public.set_pastel_credentials(
      'aaaaaaaa-0000-0000-0000-000000000003'::uuid, (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid,
      'x@example.com', null::text, 1::smallint)$$,
  '23514', null, 'un compte à créer sans mot de passe est refusé');

select is(
  (select pastel_account from public.cases
   where id = 'aaaaaaaa-0000-0000-0000-000000000003'),
  'to_create', 'après un refus, le dossier est inchangé');

-- E-mail vide
select throws_ok(
  $$select public.set_pastel_credentials(
      'aaaaaaaa-0000-0000-0000-000000000002'::uuid, (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid,
      '   ', 'x', 1::smallint)$$,
  '23514', null, 'un e-mail Pastel vide est refusé');

-- Auteur désactivé
select throws_ok(
  $$select public.set_pastel_credentials(
      'aaaaaaaa-0000-0000-0000-000000000002'::uuid, (select agency_a from ctx),
      '44444444-4444-4444-4444-444444444444'::uuid,
      'x@example.com', 'x', 1::smallint)$$,
  '42501', null, 'un auteur désactivé est refusé');

-- Auteur d'une autre agence
select throws_ok(
  $$select public.set_pastel_credentials(
      'aaaaaaaa-0000-0000-0000-000000000002'::uuid, (select agency_a from ctx),
      '33333333-3333-3333-3333-333333333333'::uuid,
      'x@example.com', 'x', 1::smallint)$$,
  '42501', null, 'un auteur d''une autre agence est refusé');

-- Dossier de l'agence A visé avec l'agence B (auteur de B)
select throws_ok(
  $$select public.set_pastel_credentials(
      'aaaaaaaa-0000-0000-0000-000000000002'::uuid, (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333'::uuid,
      'x@example.com', 'x', 1::smallint)$$,
  'P0002', null, 'un dossier d''une autre agence est introuvable');

-- Appel direct interdit aux utilisateurs connectés et aux visiteurs
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.set_pastel_credentials(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      'x@example.com', null::text, 1::smallint)$$,
  '42501', null, 'un utilisateur connecté ne peut pas appeler set_pastel_credentials');

reset role;
set local role anon;

select throws_ok(
  $$select public.set_pastel_credentials(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      'x@example.com', null::text, 1::smallint)$$,
  '42501', null, 'un visiteur ne peut pas appeler set_pastel_credentials');

select * from finish();
rollback;