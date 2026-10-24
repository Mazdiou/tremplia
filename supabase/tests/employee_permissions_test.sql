begin;
select plan(30);

-- Agence A : patron (1111), employé (2222), employé (4444) ; agence B :
-- patron (3333), employé (5555)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'a2@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b0@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'b1@test.local');

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

select public.add_employee(agency_a, '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 'Employe', 'Un') from ctx;
select public.add_employee(agency_a, '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444', 'Employe', 'Deux') from ctx;
select public.add_employee(agency_b, '33333333-3333-3333-3333-333333333333',
  '55555555-5555-5555-5555-555555555555', 'Employe', 'B') from ctx;

-- Attribution : patron seulement

select is((select permissions from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  '{}'::text[], 'un nouvel employé n''a aucune permission');

select is(
  (select public.set_employee_permissions(agency_a, '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222',
     array['payments_view', 'campaigns_manage', 'payments_view']) from ctx),
  true, 'le patron accorde des permissions');

select is((select permissions from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  array['campaigns_manage', 'payments_view'], 'la liste est triée et sans doublon');

select is(
  (select public.set_employee_permissions(agency_a, '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222', array['payments_view', 'campaigns_manage']) from ctx),
  false, 'la même liste ne change rien');

select throws_ok(
  $$select public.set_employee_permissions((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222',
      '44444444-4444-4444-4444-444444444444', array['payments_view'])$$,
  '42501', null, 'un employé, même autorisé, ne donne pas de permission');

select throws_ok(
  $$select public.set_employee_permissions((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222',
      '22222222-2222-2222-2222-222222222222', array['payments_manage'])$$,
  '42501', null, 'un employé ne s''accorde rien à lui-même');

select throws_ok(
  $$select public.set_employee_permissions((select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333',
      '22222222-2222-2222-2222-222222222222', array['payments_view'])$$,
  'P0002', null, 'le patron d''une autre agence ne touche pas à cet employé');

select throws_ok(
  $$select public.set_employee_permissions((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111',
      '11111111-1111-1111-1111-111111111111', array['payments_view'])$$,
  '42501', null, 'un patron n''a pas de liste de permissions');

select throws_ok(
  $$select public.set_employee_permissions((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111',
      '44444444-4444-4444-4444-444444444444', array['team_manage'])$$,
  '22023', null, 'une permission inconnue est refusée');

select throws_ok(
  $$update public.profiles set permissions = array['team_manage']
    where id = '44444444-4444-4444-4444-444444444444'$$,
  '23514', null, 'la table refuse aussi une permission inconnue');

-- Vérification

select ok((select public.has_permission('11111111-1111-1111-1111-111111111111', agency_a,
  'payments_manage') from ctx), 'le patron a toutes les permissions');
select ok((select public.has_permission('22222222-2222-2222-2222-222222222222', agency_a,
  'payments_view') from ctx), 'l''employé a la permission accordée');
select ok((select not public.has_permission('22222222-2222-2222-2222-222222222222', agency_a,
  'payments_manage') from ctx), 'mais pas les autres');
select ok((select not public.has_permission('22222222-2222-2222-2222-222222222222', agency_b,
  'payments_view') from ctx), 'ni dans une autre agence');

-- Campagnes

select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '44444444-4444-4444-4444-444444444444', 'Interdite', null, '{}', '[]', '[]', '{}')$$,
  '42501', null, 'un employé sans permission ne crée pas de campagne');

create temp table camp as
select public.create_campaign(agency_a, '22222222-2222-2222-2222-222222222222',
  'Campagne A', null, '{}', '[]', '[]', '{}', 100000) as id
from ctx;
grant select on camp to public;

select is((select name from public.campaigns where id = (select id from camp)),
  'Campagne A', 'un employé autorisé crée une campagne');

select lives_ok(
  $$select public.update_campaign((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Campagne A2', '{}', '[]', '[]', 120000)$$,
  'il la modifie');

select lives_ok(
  $$select public.replace_campaign_stages((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', '[{"id": null, "name": "Dépôt"}]')$$,
  'il change ses étapes');

select lives_ok(
  $$select public.set_campaign_status((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'archived')$$,
  'il l''archive');

select throws_ok(
  $$select public.set_campaign_status((select id from camp), (select agency_a from ctx),
      '44444444-4444-4444-4444-444444444444', 'active')$$,
  '42501', null, 'un employé sans permission ne la réactive pas');

select throws_ok(
  $$select public.create_campaign((select agency_b from ctx),
      '22222222-2222-2222-2222-222222222222', 'Ailleurs', null, '{}', '[]', '[]', '{}')$$,
  '42501', null, 'la permission ne vaut pas dans une autre agence');

select lives_ok(
  $$select public.delete_campaign((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  'il supprime une campagne vide');

-- Paiements

create temp table camp2 as
select public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
  'Campagne B', null, '{}', '[]', '[]', '{}') as id
from ctx;
grant select on camp2 to public;

select public.create_case('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '44444444-4444-4444-4444-444444444444', (select id from camp2),
  '44444444-4444-4444-4444-444444444444',
  '{"first_name": "Karim", "last_name": "Payeur", "birth_date": "2004-05-01",
    "phone": "0555111111", "education_level": "l3"}',
  null, null, null, 150000, '{"amount": 60000, "method": "cash"}')
from ctx;

create temp table pay as
select id from public.case_payments where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
grant select on pay to public;

select throws_ok(
  $$select public.set_case_agreed_amount('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '44444444-4444-4444-4444-444444444444', 200000)$$,
  '42501', null, 'sans permission, un employé ne change pas le montant convenu');

select throws_ok(
  $$select public.cancel_case_payment((select id from pay), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '44444444-4444-4444-4444-444444444444', 'Erreur')$$,
  '42501', null, 'sans permission, un employé n''annule pas un paiement');

select public.set_employee_permissions(agency_a, '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444', array['payments_manage']) from ctx;

select is(
  (select public.set_case_agreed_amount('cccccccc-cccc-cccc-cccc-cccccccccccc',
     agency_a, '44444444-4444-4444-4444-444444444444', 200000) from ctx),
  true, 'avec la permission, il change le montant convenu');

select is(
  (select public.cancel_case_payment((select id from pay), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
     agency_a, '44444444-4444-4444-4444-444444444444', 'Erreur') from ctx),
  60000, 'et il annule un paiement');

-- Un employé désactivé perd tout

select public.set_employee_active(agency_a, '11111111-1111-1111-1111-111111111111',
  '44444444-4444-4444-4444-444444444444', false) from ctx;

select ok((select not public.has_permission('44444444-4444-4444-4444-444444444444', agency_a,
  'payments_manage') from ctx), 'un employé désactivé n''a plus de permission');

select throws_ok(
  $$select public.set_case_agreed_amount('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '44444444-4444-4444-4444-444444444444', 210000)$$,
  '42501', null, 'et ne peut plus rien modifier');

-- Le navigateur ne change pas les permissions

select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$update public.profiles set permissions = array['payments_manage']
    where id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'un employé ne s''accorde pas de permission depuis le navigateur');

select throws_ok(
  $$select public.set_employee_permissions((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222', array['payments_manage'])$$,
  '42501', null, 'ni en appelant la fonction du serveur');

reset role;

select * from finish();
rollback;
