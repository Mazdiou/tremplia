begin;
select plan(7);

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

insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
  birth_date, phone, education_level, main_track, scope, pastel_account, pastel_email)
select agency_a, campaign, '11111111-1111-1111-1111-111111111111',
  'Karim', 'A-case', '2004-05-01', '0555111111', 'l3', 'non_dap', 'both',
  'existing', 'karim@example.com'
from ctx;

-- Contraintes (droits d'administrateur)
-- Le test d'insertion valide vient en dernier : une ligne déjà présente
-- ferait réagir la clé primaire avant le lien composite.
select throws_ok(
  $$insert into public.case_pastel_credentials (case_id, agency_id, password_encrypted)
    select c.id, (select agency_b from ctx), 'x' from public.cases c
    where c.last_name = 'A-case'$$,
  '23503', null, 'un mot de passe ne peut pas être rattaché à un dossier d''une autre agence');

select throws_ok(
  $$insert into public.case_pastel_credentials (case_id, agency_id, password_encrypted)
    select c.id, c.agency_id, '' from public.cases c where c.last_name = 'A-case'$$,
  '23514', null, 'un mot de passe vide est refusé');

select lives_ok(
  $$insert into public.case_pastel_credentials (case_id, agency_id, password_encrypted)
    select c.id, c.agency_id, 'valeur-chiffree' from public.cases c
    where c.last_name = 'A-case'$$,
  'le serveur peut enregistrer un mot de passe chiffré');

-- Patron A
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select count(*) from public.case_pastel_credentials$$,
  '42501', null, 'un patron ne peut pas lire la table des mots de passe');

select throws_ok(
  $$insert into public.case_pastel_credentials (case_id, agency_id, password_encrypted)
    values (gen_random_uuid(), gen_random_uuid(), 'x')$$,
  '42501', null, 'un patron ne peut pas écrire dans la table des mots de passe');

-- Employé A
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select count(*) from public.case_pastel_credentials$$,
  '42501', null, 'un employé ne peut pas lire la table des mots de passe');

-- Visiteur
reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.case_pastel_credentials$$,
  '42501', null, 'un visiteur ne peut pas lire la table des mots de passe');

select * from finish();
rollback;