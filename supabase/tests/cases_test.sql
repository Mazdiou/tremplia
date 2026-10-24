begin;
select plan(56);

-- Agence A : patron (1111), employé (2222), employé désactivé (5555) ;
-- agence B : patron (3333)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'a3@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b0@test.local');

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

select public.add_employee((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 'Employe', 'A');
select public.add_employee((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555555', 'Ancien', 'A');
select public.set_employee_active((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111',
  '55555555-5555-5555-5555-555555555555', false);

-- Campagnes : A1 (DAP, École), A2 (Licence) dans l'agence A ; B1 dans l'agence B
create temp table camp as
select
  public.create_campaign((select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
    'Campus France', null, array['Pastel'], '[]', '[]', array['DAP', 'École']) as a1,
  public.create_campaign((select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
    'Italie', null, '{}', '[]', '[]', array['Licence']) as a2,
  public.create_campaign((select agency_b from ctx), '33333333-3333-3333-3333-333333333333',
    'Campus France', null, '{}', '[]', '[]', array['DAP']) as b1;
grant select on camp to public;

create temp table grp as
select
  (select id from public.campaign_groups where campaign_id = (select a1 from camp) and name = 'DAP') as dap,
  (select id from public.campaign_groups where campaign_id = (select a1 from camp) and name = 'École') as ecole,
  (select id from public.campaign_groups where campaign_id = (select a2 from camp)) as licence,
  (select id from public.campaign_groups where campaign_id = (select b1 from camp)) as dap_b;
grant select on grp to public;

-- Création complète

select lives_ok(
  $$select public.create_case(
      'c1111111-1111-1111-1111-111111111111', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp),
      '22222222-2222-2222-2222-222222222222',
      '{"first_name": "Sara", "last_name": "Bénali", "birth_date": "2004-05-01",
        "phone": "0555111111", "education_level": "l3",
        "secondary_contact_name": "Mère", "secondary_contact_phone": "0555999999",
        "diplomas": [{"type": "baccalaureate", "title": null, "year": 2022}],
        "language_tests": [{"test": "tcf", "other_name": null, "result": "B2", "date": null}]}',
      array[(select dap from grp), (select ecole from grp)],
      '[{"id": "a1111111-1111-1111-1111-111111111111", "platform": "Pastel",
         "url": "https://pastel.diplomatie.gouv.fr", "login": "sara@example.com",
         "status": "existing", "password_encrypted": "Y2hpZmZyw6k=", "key_version": 1},
        {"id": "a2222222-2222-2222-2222-222222222222", "platform": "Parcoursup",
         "status": "to_create"}]',
      'Premier rendez-vous.')$$,
  'le patron crée un dossier complet');

select is(
  (select count(*) from public.case_groups
    where case_id = 'c1111111-1111-1111-1111-111111111111'),
  2::bigint, 'le dossier est classé dans deux groupes');
select is(
  (select count(*) from public.case_external_accounts
    where case_id = 'c1111111-1111-1111-1111-111111111111'),
  2::bigint, 'le dossier a ses deux comptes externes');
select is(
  (select count(*) from public.external_account_secrets
    where account_id = 'a1111111-1111-1111-1111-111111111111'),
  1::bigint, 'le mot de passe chiffré du compte existant est enregistré');
select is(
  (select author_id from public.case_notes
    where case_id = 'c1111111-1111-1111-1111-111111111111'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'la note initiale a pour auteur le créateur');
select is(
  (select search_name from public.cases where id = 'c1111111-1111-1111-1111-111111111111'),
  'benali sara', 'le nom de recherche est sans accents ni majuscules');

select lives_ok(
  $$select public.create_case(
      'c2222222-2222-2222-2222-222222222222', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', (select a1 from camp),
      '22222222-2222-2222-2222-222222222222',
      '{"first_name": "Karim", "last_name": "Test", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "bac_plus_2"}',
      null, null, null)$$,
  'un employé crée un dossier dont il est responsable');

-- Droits

select throws_ok(
  $$select public.create_case(gen_random_uuid(), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', (select a1 from camp),
      '11111111-1111-1111-1111-111111111111',
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null, null, null)$$,
  '42501', null, 'un employé ne choisit pas un autre responsable');
select throws_ok(
  $$select public.create_case(gen_random_uuid(), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp),
      '55555555-5555-5555-5555-555555555555',
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null, null, null)$$,
  '22023', null, 'un employé désactivé ne peut pas être responsable');
select throws_ok(
  $$select public.create_case(gen_random_uuid(), (select agency_a from ctx),
      '55555555-5555-5555-5555-555555555555', (select a1 from camp),
      '55555555-5555-5555-5555-555555555555',
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null, null, null)$$,
  '42501', null, 'un employé désactivé ne crée pas de dossier');
select throws_ok(
  $$select public.create_case(gen_random_uuid(), (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333', (select a1 from camp),
      '33333333-3333-3333-3333-333333333333',
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null, null, null)$$,
  '23503', null, 'une agence ne crée pas de dossier dans la campagne d''une autre');

-- Atomicité et contraintes : un échec ne laisse rien

select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}',
      array[(select dap from grp), (select licence from grp)], null, null)$$,
  '23503', null, 'un dossier ne se classe pas dans le groupe d''une autre campagne');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}',
      array[(select dap_b from grp)], null, null)$$,
  '23503', null, 'un dossier ne se classe pas dans le groupe d''une autre agence');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null,
      '[{"id": "a9999999-9999-9999-9999-999999999999", "platform": "Pastel",
         "login": "x@example.com", "status": "existing"}]', null)$$,
  '23514', null, 'un compte existant sans mot de passe est refusé');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null,
      '[{"id": "a9999999-9999-9999-9999-999999999999", "platform": "Pastel",
         "status": "existing", "password_encrypted": "eA=="}]', null)$$,
  '23514', null, 'un compte existant sans identifiant est refusé');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null,
      '[{"id": "a9999999-9999-9999-9999-999999999999", "platform": "Pastel", "status": "to_create"},
        {"id": "a8888888-8888-8888-8888-888888888888", "platform": "PASTEL", "status": "to_create"}]',
      null)$$,
  '23505', null, 'deux comptes pour la même plateforme sont refusés');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null,
      '[{"id": "a9999999-9999-9999-9999-999999999999", "platform": "Pastel",
         "url": "javascript:alert(1)", "status": "to_create"}]', null)$$,
  '23514', null, 'une adresse qui n''est pas http(s) est refusée');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null, null, '   ')$$,
  '23514', null, 'une note initiale vide est refusée');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1",
        "secondary_contact_name": "Père"}', null, null, null)$$,
  '23514', null, 'un contact secondaire sans téléphone est refusé');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1",
        "diplomas": {"type": "license"}}', null, null, null)$$,
  '23514', null, 'des diplômes qui ne sont pas une liste sont refusés');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1",
        "language_tests": [1, 2]}', null, null, null)$$,
  '23514', null, 'des tests de langue qui ne sont pas des objets sont refusés');
select throws_ok(
  $$select public.create_case('c9999999-9999-9999-9999-999999999999', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1", "passport": "123"}',
      null, null, null)$$,
  '22023', null, 'un champ inconnu (passeport, par exemple) est refusé');
select is(
  (select count(*) from public.cases where id = 'c9999999-9999-9999-9999-999999999999')
  + (select count(*) from public.case_external_accounts
      where id in ('a9999999-9999-9999-9999-999999999999',
                   'a8888888-8888-8888-8888-888888888888')),
  0::bigint, 'aucune création refusée n''a laissé de dossier ni de compte');

-- Modification

select lives_ok(
  $$select public.update_case('c2222222-2222-2222-2222-222222222222',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      '{"phone": "0666000000", "city": "Oran"}')$$,
  'un employé modifie un dossier');
select ok(
  (select phone = '0666000000' and city = 'Oran' and first_name = 'Karim'
     from public.cases where id = 'c2222222-2222-2222-2222-222222222222'),
  'seuls les champs envoyés changent');
select throws_ok(
  $$select public.update_case('c2222222-2222-2222-2222-222222222222',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      jsonb_build_object('campaign_id', (select a2 from camp)))$$,
  '22023', null, 'la campagne d''un dossier ne se modifie pas');
select throws_ok(
  $$select public.update_case('c2222222-2222-2222-2222-222222222222',
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333',
      '{"city": "Pirate"}')$$,
  'P0002', null, 'une autre agence ne modifie pas ce dossier');
select throws_ok(
  $$update public.cases set campaign_id = (select a2 from camp)
    where id = 'c2222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'même directement, la campagne d''un dossier ne change pas');

select throws_ok(
  $$select public.set_case_assignee('c2222222-2222-2222-2222-222222222222',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'un employé ne change pas le responsable');
select lives_ok(
  $$select public.set_case_assignee('c2222222-2222-2222-2222-222222222222',
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      '11111111-1111-1111-1111-111111111111')$$,
  'le patron change le responsable');

select is(
  public.set_case_status('c2222222-2222-2222-2222-222222222222',
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'closed'),
  'active', 'un employé clôt un dossier (l''ancien statut est renvoyé)');
select throws_ok(
  $$select public.set_case_status('c2222222-2222-2222-2222-222222222222',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'deleted')$$,
  '23514', null, 'un statut inconnu est refusé');

-- Classement

select throws_ok(
  $$select public.set_case_groups('c2222222-2222-2222-2222-222222222222',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      array[(select licence from grp)])$$,
  '23503', null, 'le classement reste dans la campagne du dossier');
select lives_ok(
  $$select public.set_case_groups('c1111111-1111-1111-1111-111111111111',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      array[(select ecole from grp)])$$,
  'un employé remplace le classement d''un dossier');
select is(
  (select array_agg(group_id) from public.case_groups
    where case_id = 'c1111111-1111-1111-1111-111111111111'),
  array[(select ecole from grp)], 'le dossier n''est plus que dans « École »');

select public.delete_campaign_group((select ecole from grp), (select agency_a from ctx),
  '22222222-2222-2222-2222-222222222222');
select ok(
  exists (select 1 from public.cases where id = 'c1111111-1111-1111-1111-111111111111')
  and not exists (select 1 from public.case_groups
                   where case_id = 'c1111111-1111-1111-1111-111111111111'),
  'supprimer un groupe garde le dossier, qui passe dans « Non classés »');

-- Campagne archivée et suppression

select throws_ok(
  $$select public.delete_campaign((select a1 from camp), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  '2BP01', null, 'une campagne qui a des dossiers ne se supprime pas');

select public.set_campaign_status((select a1 from camp), (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', 'archived');
select throws_ok(
  $$select public.create_case(gen_random_uuid(), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', (select a1 from camp), null,
      '{"first_name": "X", "last_name": "Y", "birth_date": "2003-01-01",
        "phone": "0555222222", "education_level": "l1"}', null, null, null)$$,
  '55000', null, 'une campagne archivée ne reçoit plus de dossier');
select lives_ok(
  $$select public.update_case('c1111111-1111-1111-1111-111111111111',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      '{"city": "Alger"}')$$,
  'les dossiers d''une campagne archivée restent modifiables');
select lives_ok(
  $$select public.set_case_groups('c1111111-1111-1111-1111-111111111111',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
      array[(select dap from grp)])$$,
  'et peuvent encore être classés');

-- Comptes externes

select throws_ok(
  $$select public.save_external_account('a2222222-2222-2222-2222-222222222222',
      'c1111111-1111-1111-1111-111111111111', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Parcoursup', null, 'sara@example.com',
      'existing', null, 1::smallint)$$,
  '23514', null, 'passer à « existing » sans mot de passe est refusé');
select is(
  public.save_external_account('a2222222-2222-2222-2222-222222222222',
    'c1111111-1111-1111-1111-111111111111', (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222', 'Parcoursup', null, 'sara@example.com',
    'existing', 'bm91dmVhdQ==', 1::smallint),
  false, 'un employé renseigne le compte avec son mot de passe');
select lives_ok(
  $$select public.save_external_account('a2222222-2222-2222-2222-222222222222',
      'c1111111-1111-1111-1111-111111111111', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Parcoursup', null, 'nouveau@example.com',
      'existing', null, 1::smallint)$$,
  'sans nouveau mot de passe, l''ancien est conservé');
select throws_ok(
  $$select public.save_external_account('a2222222-2222-2222-2222-222222222222',
      'c1111111-1111-1111-1111-111111111111', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Parcoursup', null, null,
      'to_create', null, 1::smallint)$$,
  '22023', null, 'un compte existant ne redevient pas « à créer »');
select throws_ok(
  $$select public.save_external_account(gen_random_uuid(),
      'c1111111-1111-1111-1111-111111111111', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Campus Art', null, null,
      'to_create', 'eA==', 1::smallint)$$,
  '22023', null, 'un compte à créer n''a pas de mot de passe');
select throws_ok(
  $$select public.save_external_account(gen_random_uuid(),
      'c1111111-1111-1111-1111-111111111111', (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333', 'Pirate', null, null,
      'to_create', null, 1::smallint)$$,
  'P0002', null, 'une autre agence n''ajoute pas de compte à ce dossier');

-- Lecture (RLS) et droits du serveur

select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.case_external_accounts), 2::bigint,
  'un employé voit les comptes externes de son agence');
select throws_ok(
  $$select count(*) from public.external_account_secrets$$,
  '42501', null, 'un utilisateur connecté ne lit jamais les mots de passe chiffrés');
select throws_ok(
  $$update public.cases set city = 'Directe'$$,
  '42501', null, 'le navigateur ne modifie pas un dossier directement');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.cases)
  + (select count(*) from public.case_groups)
  + (select count(*) from public.case_external_accounts),
  0::bigint, 'le patron B ne voit ni dossiers, ni classement, ni comptes de l''agence A');

reset role;
set local role service_role;

select is((select count(*) from public.external_account_secrets
           where agency_id = (select agency_a from ctx)), 2::bigint,
  'le serveur lit les mots de passe chiffrés (pour un affichage journalisé)');
select throws_ok(
  $$delete from public.cases$$,
  '42501', null, 'même le serveur ne supprime jamais un dossier');
select throws_ok(
  $$update public.cases set assigned_to = null$$,
  '42501', null, 'le serveur ne change pas le responsable sans passer par la fonction');
select throws_ok(
  $$update public.external_account_secrets set key_version = 2$$,
  '42501', null, 'le serveur n''écrit un mot de passe que par la fonction');

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.cases$$,
  '42501', null, 'un visiteur ne lit pas les dossiers');
select throws_ok(
  $$select count(*) from public.external_account_secrets$$,
  '42501', null, 'un visiteur ne lit pas les mots de passe chiffrés');

select * from finish();
rollback;
