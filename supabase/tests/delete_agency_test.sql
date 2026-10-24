begin;
select plan(20);

-- Agence A (à supprimer) : patron, employé actif, employé désactivé, dossier
-- complet, campagne archivée, document verrouillé, abonnement expiré.
-- Agence B : témoin, ne doit pas bouger. Administrateur P, dans l'agence C.
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
select public.create_agency_with_owner(
  '99999999-9999-9999-9999-999999999999', 'Agence C', 'Tizi Ouzou', '0555000003', 'Admin', 'C');
insert into public.platform_admins (user_id) values ('99999999-9999-9999-9999-999999999999');

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
  (select agency_id from public.profiles where id = '11111111-1111-1111-1111-111111111111') as agency_a,
  (select agency_id from public.profiles where id = '33333333-3333-3333-3333-333333333333') as agency_b,
  (select agency_id from public.profiles where id = '99999999-9999-9999-9999-999999999999') as agency_c;
grant select on ctx to public;

-- Dossier complet dans A, et un dossier dans B
create temp table camp as
select public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
  'Campagne A', null, '{}', '[]', '[]', '{}') as a,
  public.create_campaign(agency_b, '33333333-3333-3333-3333-333333333333',
  'Campagne B', null, '{}', '[]', '[]', '{}') as b
from ctx;

select public.create_case('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '11111111-1111-1111-1111-111111111111', (select a from camp), null,
  '{"first_name": "Karim", "last_name": "A-case", "birth_date": "2004-05-01",
    "phone": "0555111111", "education_level": "l3"}', null, null, null)
from ctx;
select public.create_case('dddddddd-dddd-dddd-dddd-dddddddddddd', agency_b,
  '33333333-3333-3333-3333-333333333333', (select b from camp), null,
  '{"first_name": "Lina", "last_name": "B-case", "birth_date": "2004-05-01",
    "phone": "0555222222", "education_level": "l3"}', null, null, null)
from ctx;

select public.set_case_agreed_amount('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '11111111-1111-1111-1111-111111111111', 100000) from ctx;
select public.record_case_payment('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '11111111-1111-1111-1111-111111111111', 40000, current_date - 1, 'cash', null) from ctx;
select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '22222222-2222-2222-2222-222222222222', 'Relevé de notes', null, null,
  '22222222-2222-2222-2222-222222222222') from ctx;
select public.send_agency_message('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '22222222-2222-2222-2222-222222222222', 'Bonjour') from ctx;
select public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '22222222-2222-2222-2222-222222222222', repeat('a', 64), 'chiffre', 1::smallint) from ctx;

insert into public.documents (id, agency_id, case_id, name, original_file_name,
    storage_path, size_bytes, uploaded_by, locked_at, locked_by)
select 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', agency_a,
  'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Passeport', 'p.pdf',
  agency_a::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee.pdf',
  100, '11111111-1111-1111-1111-111111111111', now(), '11111111-1111-1111-1111-111111111111'
from ctx;

-- Campagne archivée, abonnement expiré : A est en lecture seule
update public.campaigns set status = 'archived' where id = (select a from camp);
update public.agencies set subscription_ends_at = now() - interval '1 day'
where id = (select agency_a from ctx);

-- 1. Les protections tiennent hors de la suppression

select throws_ok(
  $$delete from public.documents where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  null, null, 'hors suppression, le document verrouillé ou en lecture seule reste protégé');
select throws_ok(
  $$delete from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'hors suppression, un patron ne se supprime pas');
select is(public.is_purging(), false, 'pas de purge en cours');

-- 2. Refus

select throws_ok(
  format('select public.delete_agency(%L, %L)',
    '11111111-1111-1111-1111-111111111111', (select agency_b from ctx)),
  '42501', null, 'un patron (non administrateur) ne peut pas supprimer une agence');
select throws_ok(
  format('select public.delete_agency(%L, %L)',
    '99999999-9999-9999-9999-999999999999', (select agency_c from ctx)),
  '42501', null, 'l''agence de l''administrateur ne peut pas être supprimée');
select throws_ok(
  $$select public.delete_agency('99999999-9999-9999-9999-999999999999', gen_random_uuid())$$,
  'P0002', null, 'agence introuvable');

-- 3. Suppression

create temp table deleted as
select public.delete_agency('99999999-9999-9999-9999-999999999999', agency_a) as users from ctx;

select is(cardinality((select users from deleted)), 3, 'trois comptes supprimés (patron et employés)');
select is((select count(*) from public.agencies where id = (select agency_a from ctx)), 0::bigint,
  'agence supprimée');
select is((select count(*) from auth.users where id in (
  '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
  '55555555-5555-5555-5555-555555555555')), 0::bigint, 'comptes de connexion supprimés');
select is((select count(*) from public.profiles where agency_id = (select agency_a from ctx)), 0::bigint,
  'profils supprimés');
select is((select count(*) from public.campaigns where agency_id = (select agency_a from ctx)), 0::bigint,
  'campagnes supprimées (même archivée)');
select is((select count(*) from public.cases where agency_id = (select agency_a from ctx)), 0::bigint,
  'dossiers supprimés');
select is((select count(*) from public.documents where agency_id = (select agency_a from ctx)), 0::bigint,
  'documents supprimés (même verrouillé)');
select is((select count(*) from public.case_payments where agency_id = (select agency_a from ctx)), 0::bigint,
  'paiements supprimés');
select is((select count(*) from public.case_messages where agency_id = (select agency_a from ctx)), 0::bigint,
  'messages supprimés');
select is((select count(*) from public.case_tasks where agency_id = (select agency_a from ctx)), 0::bigint,
  'tâches supprimées');
select is((select count(*) from public.activity_log where agency_id = (select agency_a from ctx)), 0::bigint,
  'historique supprimé');

-- B et C n'ont pas bougé
select is((select count(*) from public.cases where agency_id = (select agency_b from ctx)), 1::bigint,
  'l''autre agence garde son dossier');
select is((select count(*) from auth.users where id in (
  '33333333-3333-3333-3333-333333333333', '99999999-9999-9999-9999-999999999999')), 2::bigint,
  'les comptes des autres agences restent');
select is(public.is_purging(), false, 'réglage de purge retiré après la suppression');

select * from finish();
rollback;
