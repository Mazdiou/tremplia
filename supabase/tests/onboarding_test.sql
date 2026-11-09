begin;
select plan(27);

-- Agence A : patron (1111), employé (2222) ; agence B : patron (3333)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'onb-a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'onb-a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'onb-b0@test.local');

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

create function pg_temp.progress() returns text language sql as $$
  select concat_ws(',', hidden, has_campaign, has_case, has_document, has_student_access,
    has_task, has_employee)
  from public.onboarding_progress((select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111') $$;

-- 1. Nouvelle agence : guide affiché, bienvenue à voir

select is(pg_temp.progress(), 'f,f,f,f,f,f,f',
  'nouvelle agence : guide affiché, aucune étape faite');

select is(
  (select latest_case_id from public.onboarding_progress((select agency_a from ctx),
     '11111111-1111-1111-1111-111111111111')),
  null, 'aucun dossier : pas de dossier où mener');

select is(
  (select welcomed_at from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null, 'nouveau patron : le mot de bienvenue reste à voir');

-- 2. Les étapes se cochent d'après les données

create temp table camp as
select public.create_campaign((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', 'Campagne A', null, '{}', '[]', '[]', '{}') as id;
grant select on camp to public;

select is(pg_temp.progress(), 'f,t,f,f,f,f,f',
  'une campagne : première étape faite');

select public.create_case('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', (select id from camp), null,
  jsonb_build_object('first_name', 'Lina', 'last_name', 'Test', 'birth_date', '2004-05-01',
    'phone', '0555111111', 'education_level', 'l3'),
  null, null, null);

select is(pg_temp.progress(), 'f,t,t,f,f,f,f',
  'un dossier : deuxième étape faite');

select is(
  (select latest_case_id from public.onboarding_progress((select agency_a from ctx),
     '11111111-1111-1111-1111-111111111111')),
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'le dossier créé est celui où mener');

insert into public.documents (id, agency_id, case_id, name, original_file_name, storage_path,
  size_bytes, uploaded_by)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'Passeport', 'p.pdf',
  agency_a::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pdf', 1000,
  '11111111-1111-1111-1111-111111111111'
from ctx;

select is(pg_temp.progress(), 'f,t,t,t,f,f,f',
  'un document : troisième étape faite');

select public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
  repeat('b', 64), 'chiffre', 1::smallint);

select is(pg_temp.progress(), 'f,t,t,t,t,f,f',
  'un accès candidat : quatrième étape faite');

select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', 'Relancer pour le passeport', null, null,
  '11111111-1111-1111-1111-111111111111');

select is(pg_temp.progress(), 'f,t,t,t,t,t,f',
  'une tâche : cinquième étape faite');

select public.add_employee((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 'Employe', 'A');

select is(pg_temp.progress(), 'f,t,t,t,t,t,t',
  'un employé : sixième étape faite');

-- Page d'inscription en ligne : faite seulement si elle est ouverte aux
-- candidats (activée, avec une campagne active proposée)
create function pg_temp.signup_page() returns boolean language sql as $$
  select has_signup_page from public.onboarding_progress((select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111') $$;

select is(pg_temp.signup_page(), false, 'page d''inscription jamais ouverte : à faire');
select public.save_signup_settings((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', true, 'agence-a-onb', '{}');
select is(pg_temp.signup_page(), false, 'page activée sans campagne proposée : à faire');
select public.save_signup_settings((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', true, 'agence-a-onb', array[(select id from camp)]);
select is(pg_temp.signup_page(), true, 'page ouverte avec une campagne : faite');
select public.set_campaign_status((select id from camp), (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', 'archived');
select is(pg_temp.signup_page(), false, 'sa seule campagne archivée : de nouveau à faire');

-- 3. Cloisonnement

select is(
  (select concat_ws(',', has_campaign, has_case, has_document, has_student_access, has_task,
     has_employee)
   from public.onboarding_progress((select agency_b from ctx),
     '33333333-3333-3333-3333-333333333333')),
  'f,f,f,f,f,f', 'les données de l''agence A ne comptent pas pour B');

select throws_ok(
  $$select * from public.onboarding_progress((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'un employé ne lit pas l''avancement du guide');

select throws_ok(
  $$select * from public.onboarding_progress((select agency_b from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'le patron ne lit pas l''avancement d''une autre agence');

-- 4. Masquer et réafficher

select public.set_onboarding_hidden((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', true);

select ok(
  (select onboarding_hidden_at is not null from public.agencies
    where id = (select agency_a from ctx)),
  'le patron masque le guide');

select public.set_onboarding_hidden((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', false);

select is(
  (select onboarding_hidden_at from public.agencies where id = (select agency_a from ctx)),
  null, 'le patron réaffiche le guide');

select throws_ok(
  $$select public.set_onboarding_hidden((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', true)$$,
  '42501', null, 'un employé ne masque pas le guide');

select throws_ok(
  $$select public.set_onboarding_hidden((select agency_b from ctx),
      '11111111-1111-1111-1111-111111111111', true)$$,
  '42501', null, 'le patron ne masque pas le guide d''une autre agence');

-- Lecture seule : masquer reste permis (simple préférence d'affichage)
update public.agencies set subscription_ends_at = now() - interval '1 day'
  where id = (select agency_a from ctx);

select lives_ok(
  $$select public.set_onboarding_hidden((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', true)$$,
  'abonnement expiré : le guide se masque quand même');

-- 5. Mot de bienvenue

select lives_ok(
  $$select public.mark_welcomed((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  'abonnement expiré : le mot de bienvenue se marque quand même');

create temp table first_seen as
select welcomed_at from public.profiles where id = '22222222-2222-2222-2222-222222222222';
grant select on first_seen to public;

select public.mark_welcomed((select agency_a from ctx), '22222222-2222-2222-2222-222222222222');

select is(
  (select welcomed_at from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  (select welcomed_at from first_seen), 'la première date de bienvenue reste');

select throws_ok(
  $$select public.mark_welcomed((select agency_b from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'pas de bienvenue marquée dans une autre agence');

-- 6. Droits

select ok(
  not has_function_privilege('authenticated',
    'public.onboarding_progress(uuid, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.onboarding_progress(uuid, uuid)', 'execute'),
  'le navigateur ne lit pas l''avancement directement');

select ok(
  not has_function_privilege('authenticated',
    'public.set_onboarding_hidden(uuid, uuid, boolean)', 'execute')
  and not has_function_privilege('authenticated', 'public.mark_welcomed(uuid, uuid)', 'execute'),
  'le navigateur n''écrit pas directement');

select * from finish();
rollback;
