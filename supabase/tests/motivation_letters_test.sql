begin;
select plan(13);

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

-- Écriture
select is(
  public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    E'Madame, Monsieur,\n\nJe souhaite intégrer votre master.'),
  true, 'un employé actif écrit la lettre');

select is(
  public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
    E'Madame, Monsieur,\n\nJe souhaite intégrer votre master.'),
  false, 'un texte identique ne change rien');

select is(
  public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
    'Version du patron'),
  true, 'le patron remplace la lettre');

select is(
  (select count(*) from public.case_motivation_letters
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  1::bigint, 'une seule lettre par dossier');

select is(
  (select updated_by from public.case_motivation_letters
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'la lettre garde l''auteur de la dernière modification');

select lives_ok(
  $$select public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', '')$$,
  'une lettre peut être effacée');

select throws_ok(
  $$select public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', repeat('x', 10001))$$,
  '23514', null, 'une lettre de plus de 10 000 caractères est refusée');

select throws_ok(
  $$select public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '55555555-5555-5555-5555-555555555555', 'Compte désactivé')$$,
  '42501', null, 'un utilisateur désactivé ne peut pas écrire');

select throws_ok(
  $$select public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '33333333-3333-3333-3333-333333333333', 'Intrus')$$,
  '42501', null, 'un utilisateur d''une autre agence ne peut pas écrire');

select throws_ok(
  $$select public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333', 'Intrus')$$,
  'P0002', null, 'le dossier d''une autre agence est introuvable');

-- Lecture (RLS) : employé A1
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.case_motivation_letters),
  1::bigint, 'un membre de l''agence lit la lettre');

select throws_ok(
  $$update public.case_motivation_letters set content = 'Directe'$$,
  '42501', null, 'aucune écriture directe sans passer par la fonction');

-- Patron B
reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.case_motivation_letters),
  0::bigint, 'une autre agence ne voit pas la lettre');

select * from finish();
rollback;
