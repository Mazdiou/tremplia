begin;
select plan(42);

-- Patron A, employé A1, employé désactivé A3, patron B, administrateur P
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'a3@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b0@test.local'),
  ('99999999-9999-9999-9999-999999999999', 'admin@test.local');

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

insert into public.platform_admins (user_id) values ('99999999-9999-9999-9999-999999999999');

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

create function pg_temp.state(a uuid) returns text language sql as $$
  select state from public.agency_subscription(a) $$;
create function pg_temp.ends(a uuid) returns timestamptz language sql as $$
  select ends_at from public.agency_subscription(a) $$;
create function pg_temp.expire(a uuid) returns void language sql as $$
  update public.agencies set subscription_ends_at = now() - interval '1 minute' where id = a $$;

-- 1. Essai

select is(pg_temp.state((select agency_a from ctx)), 'trial', 'une nouvelle agence est en essai');
select is(
  (select subscription_granted from public.agencies where id = (select agency_b from ctx)),
  false, 'une nouvelle agence n''a pas d''abonnement offert');
update public.agencies set subscription_granted = true where id = (select agency_b from ctx);
select is(pg_temp.state((select agency_b from ctx)), 'active',
  'abonnement offert (agences d''avant) : active, sans paiement');
update public.agencies set subscription_granted = false where id = (select agency_b from ctx);
select ok(pg_temp.ends((select agency_a from ctx)) between now() + interval '6 days 23 hours'
                                                       and now() + interval '7 days 1 minute',
  'l''essai dure 7 jours');
select lives_ok(
  $$select public.create_case_note('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Note pendant l''essai')$$,
  'pendant l''essai, tout est permis');

-- 2. Expiré : lecture seule

select pg_temp.expire((select agency_a from ctx));
select is(pg_temp.state((select agency_a from ctx)), 'expired', 'après la date, l''agence est expirée');

select throws_ok(
  $$select public.create_case_note('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Refusée')$$,
  '25006', null, 'expirée : ajouter une note est refusé');
select throws_ok(
  $$select public.update_case('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111',
      '{"first_name": "Karim", "last_name": "Modifie", "birth_date": "2004-05-01",
        "phone": "0555111111", "education_level": "l3"}')$$,
  '25006', null, 'expirée : modifier un dossier est refusé');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      'Campagne refusée', null, '{}', '[]', '[]', '{}')$$,
  '25006', null, 'expirée : créer une campagne est refusé');
select throws_ok(
  $$select public.send_agency_message('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Bonjour')$$,
  '25006', null, 'expirée : écrire au candidat est refusé');
select throws_ok(
  $$select public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Licence', 'l3', 'Lyon', null)$$,
  '25006', null, 'expirée : ajouter une formation est refusé');
select throws_ok(
  $$delete from public.case_notes where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'$$,
  '25006', null, 'expirée : supprimer une note est refusé, même directement');
select throws_ok(
  $$select public.set_employee_active((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', true)$$,
  '25006', null, 'expirée : réactiver un employé est refusé');
select throws_ok(
  $$insert into auth.users (id, email) values ('66666666-6666-6666-6666-666666666666', 'new@test.local');
    select public.add_employee((select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      '66666666-6666-6666-6666-666666666666', 'Nouveau', 'A')$$,
  '25006', null, 'expirée : ajouter un employé est refusé');

-- Ce qui reste permis
select lives_ok(
  $$update public.profiles set must_change_password = false
    where id = '22222222-2222-2222-2222-222222222222'$$,
  'expirée : un employé peut encore remplacer son mot de passe temporaire');
select lives_ok(
  $$select public.mark_messages_read_agency('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222')$$,
  'expirée : marquer les messages comme lus reste permis');
select lives_ok(
  $$insert into public.activity_log (agency_id, actor_id, action, target_type)
    values ((select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      'external_account.password_viewed', 'case')$$,
  'expirée : le journal d''activité continue (traces de lecture)');
select is((select count(*) from public.case_notes
           where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  1::bigint, 'expirée : les données restent intactes');

-- Une autre agence n'est pas touchée
select lives_ok(
  $$select public.create_campaign((select agency_b from ctx), '33333333-3333-3333-3333-333333333333',
      'Campagne B', null, '{}', '[]', '[]', '{}')$$,
  'une autre agence, en essai, écrit normalement');

-- 3. Paiements

select throws_ok(
  $$select public.record_platform_payment('11111111-1111-1111-1111-111111111111',
      (select agency_a from ctx), 1, 5000, 'cash', null)$$,
  '42501', null, 'un patron ne peut pas enregistrer de paiement');

create temp table pay as
select public.record_platform_payment('99999999-9999-9999-9999-999999999999',
  (select agency_a from ctx), 1, 5000, 'cash', 'Reçu 1') as ends1;
grant select on pay to public;

select is(pg_temp.state((select agency_a from ctx)), 'active', 'après un paiement, l''agence est active');
select ok((select ends1 from pay) between now() + interval '1 month' - interval '1 minute'
                                     and now() + interval '1 month' + interval '1 minute',
  'expirée : un mois compté à partir d''aujourd''hui');
select lives_ok(
  $$select public.create_case_note('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'De nouveau permis')$$,
  'après le paiement, les écritures reprennent');

select is(
  public.record_platform_payment('99999999-9999-9999-9999-999999999999',
    (select agency_a from ctx), 12, 50000, 'ccp', null),
  (select ends1 from pay) + interval '12 months',
  'abonnement en cours : la durée s''ajoute à la fin actuelle');

select throws_ok(
  $$select public.record_platform_payment('99999999-9999-9999-9999-999999999999',
      (select agency_a from ctx), 2, 5000, 'cash', null)$$,
  '23514', null, 'seules les durées 1, 3 et 12 mois sont acceptées');
select throws_ok(
  $$select public.record_platform_payment('99999999-9999-9999-9999-999999999999',
      (select agency_a from ctx), 1, 5000, 'carte', null)$$,
  '23514', null, 'un moyen de paiement inconnu est refusé');
select throws_ok(
  $$select public.record_platform_payment('99999999-9999-9999-9999-999999999999',
      (select agency_a from ctx), 1, 0, 'cash', null)$$,
  '23514', null, 'un montant nul est refusé');

-- Mois offerts : moyen « gift », montant 0 obligatoire
select throws_ok(
  $$select public.record_platform_payment('99999999-9999-9999-9999-999999999999',
      (select agency_b from ctx), 1, 5000, 'gift', 'Partenaire')$$,
  '23514', null, 'des mois offerts ont un montant nul');
select lives_ok(
  $$select public.record_platform_payment('99999999-9999-9999-9999-999999999999',
      (select agency_b from ctx), 3, 0, 'gift', 'Partenaire')$$,
  'l''administrateur offre des mois sans paiement');
select is(pg_temp.state((select agency_b from ctx)), 'active', 'des mois offerts rendent l''agence active');
select ok(public.cancel_platform_payment('99999999-9999-9999-9999-999999999999',
    (select id from public.platform_payments where agency_id = (select agency_b from ctx) and method = 'gift'),
    'Erreur') is not null,
  'des mois offerts s''annulent comme un paiement');

-- 4. Annulation

select throws_ok(
  $$select public.cancel_platform_payment('99999999-9999-9999-9999-999999999999',
      (select id from public.platform_payments where agency_id = (select agency_a from ctx) and months = 1), 'Erreur')$$,
  '55000', null, 'seul le dernier paiement peut être annulé');
select throws_ok(
  $$select public.cancel_platform_payment('99999999-9999-9999-9999-999999999999',
      (select id from public.platform_payments where agency_id = (select agency_a from ctx) and months = 12), '  ')$$,
  '23514', null, 'une annulation sans motif est refusée');
select is(
  public.cancel_platform_payment('99999999-9999-9999-9999-999999999999',
    (select id from public.platform_payments where agency_id = (select agency_a from ctx) and months = 12), 'Erreur de saisie'),
  (select ends1 from pay), 'annuler le dernier paiement rétablit la fin d''avant');
select throws_ok(
  $$select public.cancel_platform_payment('99999999-9999-9999-9999-999999999999',
      (select id from public.platform_payments where agency_id = (select agency_a from ctx) and months = 12), 'Encore')$$,
  '55000', null, 'un paiement déjà annulé ne s''annule pas deux fois');
select is(public.cancel_platform_payment('99999999-9999-9999-9999-999999999999',
    (select id from public.platform_payments where agency_id = (select agency_a from ctx) and months = 1), 'Erreur'),
  (select previous_ends_at from public.platform_payments where agency_id = (select agency_a from ctx) and months = 1),
  'puis le précédent devient annulable');
select is(pg_temp.state((select agency_a from ctx)), 'expired',
  'sans paiement valable et date passée, l''agence redevient expirée');

-- 5. Liste et droits

select is((select count(*) from public.platform_agencies('99999999-9999-9999-9999-999999999999') l
           where l.id in ((select agency_a from ctx), (select agency_b from ctx))),
  2::bigint, 'l''administrateur voit toutes les agences');
select throws_ok(
  $$select * from public.platform_agencies('11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'un patron ne voit pas la liste des agences');

-- Lecture (RLS) des paiements : le patron A seulement
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.platform_payments), 2::bigint,
  'le patron voit les paiements de son agence');
select throws_ok(
  $$select public.record_platform_payment('99999999-9999-9999-9999-999999999999',
      (select agency_a from ctx), 1, 5000, 'cash', null)$$,
  '42501', null, 'un utilisateur connecté n''appelle pas la fonction de paiement');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.platform_payments), 0::bigint,
  'un employé ne voit pas les paiements de l''agence');

reset role;
select * from finish();
rollback;
