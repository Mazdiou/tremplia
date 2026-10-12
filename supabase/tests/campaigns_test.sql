begin;
select plan(8);

-- Données de test : agence A (patron a1, employé a2)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a2@test.local');

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');

insert into public.profiles (id, agency_id, first_name, last_name, role)
select '22222222-2222-2222-2222-222222222222', agency_id, 'Employe', 'A', 'employee'
from public.profiles where id = '11111111-1111-1111-1111-111111111111';

-- Contraintes de la table (avec les droits d'administrateur)
select throws_ok(
  $$insert into public.campaigns (label, is_current) values ('2098/2099', true)$$,
  '23505', null, 'deux campagnes en cours en même temps sont refusées');

select throws_ok(
  $$insert into public.campaigns (label, opens_on, deadline_dap)
    values ('2097/2098', '2097-10-01', '2097-09-01')$$,
  '23514', null, 'une date limite avant l''ouverture est refusée');

-- Patron A
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.campaigns where label = '2026/2027'), 1::bigint,
  'le patron lit la campagne 2026/2027');

select throws_ok(
  $$update public.campaigns set label = 'Piratee'$$,
  '42501', null, 'un patron ne peut pas modifier une campagne');

select throws_ok(
  $$delete from public.campaigns$$,
  '42501', null, 'un patron ne peut pas supprimer une campagne');

-- Employé A
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.campaigns where label = '2026/2027'), 1::bigint,
  'un employé lit la campagne 2026/2027');

select throws_ok(
  $$insert into public.campaigns (label) values ('Pirate')$$,
  '42501', null, 'un employé ne peut pas créer de campagne');

-- Visiteur non connecté
reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.campaigns$$,
  '42501', null, 'un visiteur non connecté ne peut pas lire les campagnes');

select * from finish();
rollback;