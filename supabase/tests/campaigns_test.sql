begin;
select plan(65);

-- Données de test : agence A (patron a1, employé a2), agence B (patron b1)
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
  (select id from public.campaign_templates
    where slug = 'campus-france-2026-2027') as tpl;

-- ===== Le modèle Campus France fourni par la migration =====

select is(
  (select count(*) from public.campaign_template_deadlines
   where template_id = (select tpl from ctx)),
  7::bigint, 'le modèle Campus France contient les 7 dates');

select is(
  (select string_agg(name, ',' order by position)
   from public.campaign_template_folders where template_id = (select tpl from ctx)),
  'DAP,Hors-DAP,École', 'le modèle contient les dossiers DAP, Hors-DAP et École');

select is(
  (select platform_name from public.campaign_templates where id = (select tpl from ctx)),
  'Pastel', 'le modèle Campus France utilise la plateforme Pastel');

-- ===== Import d'un modèle =====

create temp table imp as
select public.import_campaign_template(
  (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111'::uuid,
  (select tpl from ctx)) as id;

select is(
  (select count(*) from public.campaigns
   where id = (select id from imp)
     and agency_id = (select agency_a from ctx)
     and template_id = (select tpl from ctx)
     and platform_name = 'Pastel'
     and status = 'active'
     and name = 'Campus France 2026/2027 (Algérie)'),
  1::bigint, 'l''import crée une campagne active de l''agence, nommée comme le modèle');

select is(
  (select count(*) from public.campaign_deadlines where campaign_id = (select id from imp)),
  7::bigint, 'l''import copie les 7 dates');

select is(
  (select string_agg(name, ',' order by position)
   from public.campaign_folders where campaign_id = (select id from imp)),
  'DAP,Hors-DAP,École', 'l''import copie les dossiers de rangement dans l''ordre');

-- La copie est indépendante du modèle
update public.campaign_folders set name = 'Licences'
where campaign_id = (select id from imp) and name = 'DAP';
update public.campaign_deadlines set label = 'Ma date', due_on = '2030-01-01'
where campaign_id = (select id from imp) and position = 1;

select is(
  (select count(*) from public.campaign_template_folders
   where template_id = (select tpl from ctx) and name = 'DAP'),
  1::bigint, 'renommer un dossier de la copie ne change pas le modèle');

select is(
  (select label from public.campaign_template_deadlines
   where template_id = (select tpl from ctx) and position = 1),
  'Date limite hors-DAP', 'modifier une date de la copie ne change pas le modèle');

-- Refus d'import
select throws_ok(
  $$select public.import_campaign_template(
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222'::uuid,
      (select tpl from ctx), 'Par employe')$$,
  '42501', null, 'un employé ne peut pas importer une campagne');

select throws_ok(
  $$select public.import_campaign_template(
      (select agency_a from ctx), '33333333-3333-3333-3333-333333333333'::uuid,
      (select tpl from ctx), 'Par patron B')$$,
  '42501', null, 'le patron d''une autre agence ne peut pas importer dans cette agence');

select throws_ok(
  $$select public.import_campaign_template(
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
      gen_random_uuid(), 'Inconnu')$$,
  'P0002', null, 'un modèle inexistant est refusé');

select throws_ok(
  $$select public.import_campaign_template(
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
      (select tpl from ctx))$$,
  '23505', null, 'importer deux fois sous le même nom est refusé');

select lives_ok(
  $$select public.import_campaign_template(
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
      (select tpl from ctx), 'Campus France session 2')$$,
  'importer deux fois le même modèle sous un autre nom est possible');

-- L'agence B importe aussi le modèle : copie séparée, mêmes noms autorisés
select lives_ok(
  $$select public.import_campaign_template(
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333'::uuid,
      (select tpl from ctx))$$,
  'une autre agence peut importer le même modèle sous le même nom');

-- ===== Campagne libre =====

select lives_ok(
  $$select public.create_campaign(
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
      'Italie 2026/2027', 'Universités italiennes', 'Universitaly',
      '[{"label":"Ouverture","due_on":"2026-09-01"},
        {"label":"Dépôt des dossiers","due_on":"2026-12-01","note":"Avant minuit"}]'::jsonb)$$,
  'le patron crée une campagne libre avec ses dates');

select is(
  (select string_agg(d.label, ',' order by d.position)
   from public.campaign_deadlines d join public.campaigns c on c.id = d.campaign_id
   where c.name = 'Italie 2026/2027'),
  'Ouverture,Dépôt des dossiers', 'les dates sont enregistrées dans l''ordre donné');

select is(
  (select platform_name from public.campaigns where name = 'Italie 2026/2027'),
  'Universitaly', 'la plateforme de candidature est libre');

select lives_ok(
  $$select public.create_campaign(
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
      'Sans dates', null, null, null)$$,
  'une campagne sans date ni plateforme est possible');

select throws_ok(
  $$select public.create_campaign(
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
      'Ratee', null, null, '[{"label":"X","due_on":"pas-une-date"}]'::jsonb)$$,
  '22007', null, 'une date invalide est refusée');

select is(
  (select count(*) from public.campaigns where name = 'Ratee'),
  0::bigint, 'une création échouée ne laisse aucune campagne à moitié créée');

select throws_ok(
  $$select public.create_campaign(
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
      'Objet', null, null, '{"label":"X"}'::jsonb)$$,
  '22023', null, 'les dates doivent être données sous forme de liste');

select throws_ok(
  $$select public.create_campaign(
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
      'ITALIE 2026/2027', null, null, null)$$,
  '23505', null, 'un nom déjà pris est refusé, sans tenir compte des majuscules');

select throws_ok(
  $$select public.create_campaign(
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222'::uuid,
      'Par employe', null, null, null)$$,
  '42501', null, 'un employé ne peut pas créer de campagne');

select throws_ok(
  $$select public.create_campaign(
      (select agency_a from ctx), '33333333-3333-3333-3333-333333333333'::uuid,
      'Par patron B', null, null, null)$$,
  '42501', null, 'le patron d''une autre agence ne peut pas créer de campagne ici');

-- ===== Contraintes de la table (droits d'administrateur) =====

select throws_ok(
  $$insert into public.campaigns (agency_id, name) select agency_a, ' Espaces ' from ctx$$,
  '23514', null, 'un nom avec des espaces autour est refusé');

select throws_ok(
  $$insert into public.campaigns (agency_id, name) select agency_a, '' from ctx$$,
  '23514', null, 'un nom vide est refusé');

select throws_ok(
  $$update public.campaigns set status = 'archived' where name = 'Sans dates'$$,
  '23514', null, 'archiver sans date d''archivage est refusé');

select lives_ok(
  $$update public.campaigns set status = 'archived', archived_at = now()
    where name = 'Sans dates'$$,
  'archiver une campagne avec sa date d''archivage fonctionne');

select throws_ok(
  $$update public.campaigns set agency_id = (select agency_b from ctx)
    where name = 'Italie 2026/2027'$$,
  '42501', null, 'l''agence d''une campagne n''est pas modifiable');

select throws_ok(
  $$update public.campaigns set template_id = (select tpl from ctx)
    where name = 'Italie 2026/2027'$$,
  '42501', null, 'le modèle d''origine d''une campagne n''est pas modifiable');

-- Les dates et dossiers de rangement restent dans l'agence de la campagne
select throws_ok(
  $$insert into public.campaign_deadlines (agency_id, campaign_id, label, due_on)
    select agency_b, (select id from imp), 'Intrus', '2027-01-01' from ctx$$,
  '23503', null, 'une date ne peut pas être rattachée à la campagne d''une autre agence');

select throws_ok(
  $$insert into public.campaign_folders (agency_id, campaign_id, name)
    select agency_b, (select id from imp), 'Intrus' from ctx$$,
  '23503', null, 'un dossier de rangement ne peut pas viser la campagne d''une autre agence');

select throws_ok(
  $$insert into public.campaign_folders (agency_id, campaign_id, name)
    select agency_a, (select id from imp), 'hors-dap' from ctx$$,
  '23505', null, 'deux dossiers de rangement du même nom sont refusés');

select throws_ok(
  $$update public.campaign_folders set campaign_id = (
      select id from public.campaigns where name = 'Italie 2026/2027')
    where name = 'Licences'$$,
  '42501', null, 'un dossier de rangement ne change pas de campagne');

-- ===== Dossiers candidats : campagne de la même agence =====

select throws_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, main_track, scope, pastel_account)
    select agency_b, (select id from imp), '33333333-3333-3333-3333-333333333333',
      'X', 'Y', '2004-01-01', '0555', 'l3', 'dap', 'both', 'to_create' from ctx$$,
  '23503', null, 'un dossier ne peut pas être rattaché à la campagne d''une autre agence');

-- Un même candidat dans deux campagnes : deux dossiers totalement séparés
insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
  birth_date, phone, education_level, main_track, scope, pastel_account)
select agency_a, (select id from imp), '11111111-1111-1111-1111-111111111111',
  'Karim', 'Test', '2004-05-01', '0555111111', 'l3', 'dap', 'both', 'to_create'
from ctx;

select lives_ok(
  $$insert into public.cases (agency_id, campaign_id, created_by, first_name, last_name,
      birth_date, phone, education_level, main_track, scope, pastel_account)
    select agency_a, (select id from public.campaigns where name = 'Italie 2026/2027'),
      '11111111-1111-1111-1111-111111111111',
      'Karim', 'Test', '2004-05-01', '0555111111', 'l3', 'dap', 'both', 'to_create'
    from ctx$$,
  'le même candidat peut avoir un dossier dans une autre campagne');

select is(
  (select count(distinct id) from public.cases
   where first_name = 'Karim' and last_name = 'Test'),
  2::bigint, 'ce sont deux dossiers distincts');

-- ===== Suppression =====

select throws_ok(
  $$select public.delete_campaign((select id from imp), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid)$$,
  '23503', null, 'une campagne qui contient des dossiers ne se supprime pas');

select throws_ok(
  $$select public.delete_campaign(
      (select id from public.campaigns where name = 'Italie 2026/2027'),
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222'::uuid)$$,
  '42501', null, 'un employé ne peut pas supprimer une campagne');

select throws_ok(
  $$select public.delete_campaign(
      (select id from public.campaigns where name = 'Sans dates'),
      (select agency_a from ctx), '33333333-3333-3333-3333-333333333333'::uuid)$$,
  '42501', null, 'le patron d''une autre agence ne peut pas supprimer cette campagne');

select throws_ok(
  $$select public.delete_campaign(gen_random_uuid(), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid)$$,
  'P0002', null, 'supprimer une campagne inexistante est refusé');

select lives_ok(
  $$select public.delete_campaign(
      (select id from public.campaigns where name = 'Sans dates'),
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid)$$,
  'le patron supprime une campagne vide');

select public.create_campaign(
  (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
  'Temporaire', null, null, '[{"label":"X","due_on":"2027-01-01"}]'::jsonb);
select public.delete_campaign(
  (select id from public.campaigns where name = 'Temporaire'),
  (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid);

select is(
  (select count(*) from public.campaign_deadlines where label = 'X'),
  0::bigint, 'supprimer une campagne supprime aussi ses dates');

select throws_ok(
  $$select public.delete_campaign_folder(
      (select id from public.campaign_folders where name = 'Licences'),
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222'::uuid)$$,
  '42501', null, 'un employé ne peut pas supprimer un dossier de rangement');

select throws_ok(
  $$select public.delete_campaign_folder(
      (select id from public.campaign_folders where name = 'Licences'),
      (select agency_a from ctx), '33333333-3333-3333-3333-333333333333'::uuid)$$,
  '42501', null, 'le patron d''une autre agence ne peut pas supprimer ce dossier de rangement');

select lives_ok(
  $$select public.delete_campaign_folder(
      (select id from public.campaign_folders where name = 'Licences'),
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid)$$,
  'le patron supprime un dossier de rangement');

select throws_ok(
  $$select public.delete_campaign_folder(gen_random_uuid(), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid)$$,
  'P0002', null, 'supprimer un dossier de rangement inexistant est refusé');

-- ===== Droits : patron A =====

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.campaigns where name = 'Campus France 2026/2027 (Algérie)'),
  1::bigint, 'le patron A ne voit que la campagne importée de son agence');

select is(
  (select count(*) from public.campaign_deadlines where label = 'Ma date'),
  1::bigint, 'le patron A lit les dates de ses campagnes');

select is(
  (select count(*) from public.campaign_template_deadlines),
  7::bigint, 'le patron A lit les modèles de campagne publiés');

select throws_ok(
  $$insert into public.campaigns (agency_id, name)
    values (gen_random_uuid(), 'Directe')$$,
  '42501', null, 'un utilisateur connecté ne peut pas créer de campagne directement');

select throws_ok(
  $$update public.campaigns set name = 'Piratee'$$,
  '42501', null, 'un utilisateur connecté ne peut pas modifier une campagne directement');

select throws_ok(
  $$delete from public.campaigns$$,
  '42501', null, 'un utilisateur connecté ne peut pas supprimer une campagne directement');

select throws_ok(
  $$insert into public.campaign_templates (slug, name) values ('pirate', 'Pirate')$$,
  '42501', null, 'un utilisateur connecté ne peut pas ajouter de modèle');

-- ===== Droits : employé A =====

reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.campaigns where name = 'Italie 2026/2027'),
  1::bigint, 'un employé lit les campagnes de son agence');

-- ===== Droits : patron B =====

reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.campaigns where name = 'Italie 2026/2027'),
  0::bigint, 'le patron B ne voit pas les campagnes de l''agence A');

select is(
  (select count(*) from public.campaigns),
  1::bigint, 'le patron B ne voit que sa propre campagne');

select is(
  (select count(*) from public.campaign_deadlines where label = 'Ma date'),
  0::bigint, 'le patron B ne voit pas les dates de l''agence A');

-- ===== Droits : serveur et visiteur =====

reset role;
set local role service_role;

select throws_ok(
  $$delete from public.campaigns$$,
  '42501', null, 'même le serveur ne supprime pas une campagne en direct');

select throws_ok(
  $$delete from public.campaign_folders$$,
  '42501', null, 'même le serveur ne supprime pas un dossier de rangement en direct');

select throws_ok(
  $$insert into public.campaign_templates (slug, name) values ('pirate', 'Pirate')$$,
  '42501', null, 'même le serveur n''ajoute pas de modèle : seules les migrations le font');

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.campaigns$$,
  '42501', null, 'un visiteur non connecté ne peut pas lire les campagnes');

select throws_ok(
  $$select count(*) from public.campaign_templates$$,
  '42501', null, 'un visiteur non connecté ne peut pas lire les modèles');

-- ===== Modèle non publié =====

reset role;
update public.campaign_templates set is_published = false
where slug = 'campus-france-2026-2027';

select throws_ok(
  $$select public.import_campaign_template(
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111'::uuid,
      (select tpl from ctx), 'Non publie')$$,
  'P0002', null, 'un modèle non publié ne peut pas être importé');

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.campaign_templates),
  0::bigint, 'un modèle non publié est invisible pour les agences');

select * from finish();
