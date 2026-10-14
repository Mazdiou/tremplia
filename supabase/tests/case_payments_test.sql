begin;
select plan(30);

-- Patron A, employé A1, patron B
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b0@test.local');

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');
select public.create_agency_with_owner(
  '33333333-3333-3333-3333-333333333333', 'Agence B', 'Oran', '0555000002', 'Patron', 'B');

insert into public.profiles (id, agency_id, first_name, last_name, role, is_active)
select '22222222-2222-2222-2222-222222222222', agency_id, 'Employe1', 'A', 'employee', true
from public.profiles where id = '11111111-1111-1111-1111-111111111111';

create temp table ctx as
select
  (select agency_id from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') as agency_a,
  (select agency_id from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') as agency_b;
grant select on ctx to public;

-- Campagne avec un tarif par défaut
create temp table camp as
select public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
  'Campagne A', null, '{}', '[]', '[]', '{}', 150000) as id
from ctx;
grant select on camp to public;

select is((select default_fee from public.campaigns where id = (select id from camp)),
  150000, 'la campagne garde son tarif par défaut');

-- Dossier 1 : créé par l'employé, montant convenu et premier paiement
select public.create_case('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '22222222-2222-2222-2222-222222222222', (select id from camp),
  '22222222-2222-2222-2222-222222222222',
  '{"first_name": "Karim", "last_name": "Payeur", "birth_date": "2004-05-01",
    "phone": "0555111111", "education_level": "l3"}',
  null, null, null, 150000, '{"amount": 60000, "method": "cash"}')
from ctx;

select is((select agreed_amount from public.cases
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  150000, 'le montant convenu est enregistré à la création');
select is((select amount from public.case_payments
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  60000, 'le premier paiement est enregistré à la création');

-- Dossier 2 : sans montant ni paiement (anciens appels à 9 paramètres)
select public.create_case('dddddddd-dddd-dddd-dddd-dddddddddddd', agency_a,
  '22222222-2222-2222-2222-222222222222', (select id from camp),
  '22222222-2222-2222-2222-222222222222',
  '{"first_name": "Lina", "last_name": "Plus-tard", "birth_date": "2005-02-01",
    "phone": "0555222222", "education_level": "terminale"}',
  null, null, null)
from ctx;

select is((select agreed_amount from public.cases
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  null, 'un dossier peut être créé sans montant convenu');

select throws_ok(
  $$select public.create_case('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', (select id from camp),
      '22222222-2222-2222-2222-222222222222',
      '{"first_name": "X", "last_name": "Y", "birth_date": "2005-02-01",
        "phone": "0555333333", "education_level": "l1"}',
      null, null, null, null, '{"amount": 1000, "method": "cash"}')$$,
  '55000', null, 'pas de paiement sans montant convenu, à la création');

select throws_ok(
  $$select public.record_case_payment('dddddddd-dddd-dddd-dddd-dddddddddddd',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      1000, current_date, 'cash', null)$$,
  '55000', null, 'pas de paiement sans montant convenu, ensuite');

-- Montant convenu : l'employé le fixe une fois, seul le patron le change
select is(public.set_case_agreed_amount('dddddddd-dddd-dddd-dddd-dddddddddddd',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 100000),
  true, 'un employé fixe le montant convenu encore vide');
select is(public.set_case_agreed_amount('dddddddd-dddd-dddd-dddd-dddddddddddd',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 100000),
  false, 'le même montant ne change rien');
select throws_ok(
  $$select public.set_case_agreed_amount('dddddddd-dddd-dddd-dddd-dddddddddddd',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 90000)$$,
  '42501', null, 'un employé ne change pas un montant déjà fixé');
select is(public.set_case_agreed_amount('dddddddd-dddd-dddd-dddd-dddddddddddd',
    (select agency_a from ctx), '11111111-1111-1111-1111-111111111111', 90000),
  true, 'le patron change le montant convenu');

-- Paiements du dossier 1 : reste 90 000
create temp table pay as
select public.record_case_payment('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '22222222-2222-2222-2222-222222222222', 40000, current_date - 1, 'transfer', 'Réf. 8841') as p2
from ctx;
grant select on pay to public;

select is((select count(*) from public.case_payments
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  2::bigint, 'un employé enregistre un paiement');

select throws_ok(
  $$select public.record_case_payment('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      50001, current_date, 'cash', null)$$,
  '22003', null, 'un paiement ne dépasse pas le reste à payer');
select throws_ok(
  $$select public.record_case_payment('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      0, current_date, 'cash', null)$$,
  '22003', null, 'un paiement est positif');
select throws_ok(
  $$select public.record_case_payment('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      1000, current_date + 2, 'cash', null)$$,
  '22007', null, 'pas de date de paiement future');
select throws_ok(
  $$select public.record_case_payment('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      1000, current_date, 'bitcoin', null)$$,
  '23514', null, 'moyen de paiement inconnu refusé');
select throws_ok(
  $$select public.set_case_agreed_amount('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111', 99999)$$,
  '22003', null, 'le montant convenu ne descend pas sous le total payé');
select throws_ok(
  $$select public.record_case_payment('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333',
      1000, current_date, 'cash', null)$$,
  'P0002', null, 'une autre agence n''enregistre rien sur le dossier');

-- Annulation : patron seulement, une seule fois, avec un motif
select throws_ok(
  $$select public.cancel_case_payment((select p2 from pay),
      'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Erreur de saisie')$$,
  '42501', null, 'un employé n''annule pas un paiement');
select is(public.cancel_case_payment((select p2 from pay),
    'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111', 'Erreur de saisie'),
  40000, 'le patron annule un paiement');
select throws_ok(
  $$select public.cancel_case_payment((select p2 from pay),
      'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Encore')$$,
  '55000', null, 'un paiement annulé ne s''annule pas deux fois');

-- Le paiement annulé ne compte plus : 90 000 peuvent être payés
select isnt(public.record_case_payment('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    90000, current_date, 'ccp', null),
  null, 'le reste à payer ne compte pas le paiement annulé');

-- Totaux gardés sur le dossier
select is((select paid_amount from public.cases
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  150000, 'le total payé suit les paiements et les annulations');
select is((select remaining_amount from public.cases
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  0, 'un dossier soldé ne doit plus rien');
select is((select remaining_amount from public.cases
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  90000, 'reste à payer d''un dossier sans paiement');
select throws_ok(
  $$update public.cases set paid_amount = 999999
    where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  '23514', null, 'jamais plus payé que convenu, même en écriture directe');
select is(
  (select sum(remaining)::bigint from public.case_stats
    where campaign_id = (select id from camp)),
  90000::bigint, 'case_stats : reste à encaisser de la campagne');
select is(
  (select sum(amount)::bigint from public.payment_months
    where campaign_id = (select id from camp)),
  150000::bigint, 'payment_months : encaissé, sans le paiement annulé');

-- Lecture (RLS) : employé A1, puis patron B
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.case_payments), 3::bigint,
  'un membre de l''agence lit les paiements');
select throws_ok(
  $$update public.case_payments set amount = 1$$,
  '42501', null, 'aucune écriture directe sans passer par les fonctions');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.case_payments), 0::bigint,
  'une autre agence ne voit pas les paiements');

select * from finish();
rollback;
