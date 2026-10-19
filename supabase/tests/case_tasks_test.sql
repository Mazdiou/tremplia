begin;
select plan(66);

-- Patron A, employés A1, A2 et A3 (A3 est désactivé), patron B
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'a2@test.local'),
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
    ('44444444-4444-4444-4444-444444444444'::uuid, 'Employe2', true),
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

-- Dossiers C et D : agence A ; dossier E : agence B
select public.create_case(v.id, v.agency, v.actor,
  public.create_campaign(v.agency, v.actor, 'Campagne ' || v.fn, null, '{}', '[]', '[]', '{}'),
  null,
  jsonb_build_object('first_name', v.fn, 'last_name', 'Test', 'birth_date', '2004-05-01',
    'phone', '0555111111', 'education_level', 'l3'),
  null, null, null)
from ctx,
  (values
    ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'C', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'D', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111'::uuid),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'E', (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333'::uuid)
  ) as v(id, fn, agency, actor);

create function pg_temp.open_count(p_case uuid) returns bigint language sql as $$
  select count(*) from public.case_tasks where case_id = p_case and done_at is null $$;

-- 1. Créer ------------------------------------------------------------------

-- t1 : créée par A1 pour lui-même
create temp table t1 as
select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
  '22222222-2222-2222-2222-222222222222', 'Appeler pour le relevé de notes', null,
  date '2026-10-23', '22222222-2222-2222-2222-222222222222') as id;
grant select on t1 to public;

select ok((select id from t1) is not null, 'un employé actif ajoute une tâche');

select ok(
  (select created_by = '22222222-2222-2222-2222-222222222222'
      and assigned_to = '22222222-2222-2222-2222-222222222222'
      and done_at is null and done_by is null
     from public.case_tasks where id = (select id from t1)),
  'la tâche neuve est à faire, avec son auteur et son responsable');

-- t2 : créée par A1, confiée à A2
create temp table t2 as
select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
  '22222222-2222-2222-2222-222222222222', 'Vérifier le passeport', 'Expire en mars',
  null, '44444444-4444-4444-4444-444444444444') as id;
grant select on t2 to public;

select is(
  (select assigned_to from public.case_tasks where id = (select id from t2)),
  '44444444-4444-4444-4444-444444444444'::uuid,
  'un employé confie une tâche à un collègue, sans échéance');

select throws_ok(
  $$select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'x', null, null, '55555555-5555-5555-5555-555555555555')$$,
  '22023', null, 'une tâche ne se confie pas à un membre désactivé');

select throws_ok(
  $$select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'x', null, null, '33333333-3333-3333-3333-333333333333')$$,
  '22023', null, 'une tâche ne se confie pas à une autre agence');

select throws_ok(
  $$select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', '   ', null, null, '22222222-2222-2222-2222-222222222222')$$,
  '23514', null, 'un intitulé vide est refusé');

select throws_ok(
  $$select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', repeat('x', 201), null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  '23514', null, 'un intitulé de plus de 200 caractères est refusé');

select throws_ok(
  $$select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'x', ' ', null, '22222222-2222-2222-2222-222222222222')$$,
  '23514', null, 'une précision vide est refusée (null à la place)');

select throws_ok(
  $$select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'x', null, date '1999-01-01',
      '22222222-2222-2222-2222-222222222222')$$,
  '23514', null, 'une échéance hors bornes est refusée');

select throws_ok(
  $$select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '33333333-3333-3333-3333-333333333333', 'Intrus', null, null,
      '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'un utilisateur d''une autre agence ne peut pas créer');

select throws_ok(
  $$select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '55555555-5555-5555-5555-555555555555', 'x', null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'un utilisateur désactivé ne peut pas créer');

select throws_ok(
  $$select public.create_case_task('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'x', null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  'P0002', null, 'le dossier d''une autre agence est introuvable');

-- 2. Modifier ---------------------------------------------------------------

select throws_ok(
  $$select public.update_case_task((select id from t1), (select agency_a from ctx),
      '44444444-4444-4444-4444-444444444444', 'Réécrite', null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'un employé ni auteur ni responsable ne modifie pas la tâche');

select throws_ok(
  $$select public.update_case_task((select id from t1), (select agency_a from ctx),
      '33333333-3333-3333-3333-333333333333', 'Réécrite', null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'le patron d''une autre agence ne modifie pas la tâche');

select is(
  public.update_case_task((select id from t1), (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222', 'Appeler le père', 'Le soir', date '2026-10-24',
    '22222222-2222-2222-2222-222222222222'),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'l''auteur modifie sa tâche (l''ancien responsable est renvoyé)');

select ok(
  (select title = 'Appeler le père' and details = 'Le soir' and due_date = date '2026-10-24'
     from public.case_tasks where id = (select id from t1)),
  'la modification est enregistrée');

select is(
  public.update_case_task((select id from t2), (select agency_a from ctx),
    '44444444-4444-4444-4444-444444444444', 'Vérifier le passeport', null, null,
    '11111111-1111-1111-1111-111111111111'),
  '44444444-4444-4444-4444-444444444444'::uuid,
  'le responsable modifie la tâche et la confie au patron');

select throws_ok(
  $$select public.update_case_task((select id from t2), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'x', null, null,
      '55555555-5555-5555-5555-555555555555')$$,
  '22023', null, 'une tâche ne se confie pas à un membre désactivé');

select throws_ok(
  $$select public.update_case_task(gen_random_uuid(), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'x', null, null,
      '11111111-1111-1111-1111-111111111111')$$,
  'P0002', null, 'modifier une tâche inconnue est refusé');

-- 3. Faite / rouverte -------------------------------------------------------

select throws_ok(
  $$select public.set_case_task_done((select id from t1), (select agency_a from ctx),
      '44444444-4444-4444-4444-444444444444', true)$$,
  '42501', null, 'un employé ni auteur ni responsable ne coche pas la tâche');

select is(
  public.set_case_task_done((select id from t1), (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222', true),
  true, 'le responsable coche sa tâche');

select ok(
  (select done_at is not null and done_by = '22222222-2222-2222-2222-222222222222'
     from public.case_tasks where id = (select id from t1)),
  'la tâche faite garde qui l''a faite et quand');

select is(
  public.set_case_task_done((select id from t1), (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222', true),
  false, 'cocher une tâche déjà faite ne change rien');

select is(
  public.set_case_task_done((select id from t1), (select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111', false),
  true, 'le patron rouvre la tâche d''un employé');

select ok(
  (select done_at is null and done_by is null
     from public.case_tasks where id = (select id from t1)),
  'la tâche rouverte est de nouveau à faire');

-- 4. Supprimer --------------------------------------------------------------

-- t4 : créée par le patron, confiée à A2
create temp table t4 as
select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', 'Envoyer le devis', null, null,
  '44444444-4444-4444-4444-444444444444') as id;
grant select on t4 to public;

select throws_ok(
  $$select public.delete_case_task((select id from t4), (select agency_a from ctx),
      '44444444-4444-4444-4444-444444444444')$$,
  '42501', null, 'le responsable ne supprime pas une tâche qu''il n''a pas créée');

select is(
  public.set_case_task_done((select id from t4), (select agency_a from ctx),
    '44444444-4444-4444-4444-444444444444', true),
  true, 'mais il peut la cocher');

select lives_ok(
  $$select public.delete_case_task((select id from t1), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  'l''auteur supprime sa tâche');

select ok(
  not exists (select 1 from public.case_tasks where id = (select id from t1)),
  'la tâche supprimée a disparu');

select lives_ok(
  $$select public.delete_case_task((select id from t4), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  'le patron supprime une tâche');

select throws_ok(
  $$select public.delete_case_task(gen_random_uuid(), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  'P0002', null, 'supprimer une tâche inconnue est refusé');

-- 5. Limite de 100 tâches à faire -------------------------------------------

-- Dossier D : 101 tâches, dont une faite → 100 à faire
insert into public.case_tasks (agency_id, case_id, title, assigned_to, created_by)
select agency_a, 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Tâche ' || g,
  '22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222'
from ctx, generate_series(1, 101) as g;
update public.case_tasks
set done_at = now(), done_by = '22222222-2222-2222-2222-222222222222'
where case_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and title = 'Tâche 1';

select throws_ok(
  $$select public.create_case_task('dddddddd-dddd-dddd-dddd-dddddddddddd', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'De trop', null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  '54000', null, 'au-delà de 100 tâches à faire, l''ajout est refusé');

select throws_ok(
  $$select public.set_case_task_done(
      (select id from public.case_tasks
        where case_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and title = 'Tâche 1'),
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', false)$$,
  '54000', null, 'rouvrir une tâche compte aussi dans la limite');

select throws_ok(
  $$select * from public.create_cases_task(
      array['cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd']::uuid[],
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'Groupée', null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  '54000', null, 'actions groupées : un dossier plein refuse l''ensemble');

-- 6. Clôture du dossier : tout marquer fait ---------------------------------

select is(
  (select count(*) from public.complete_case_tasks('dddddddd-dddd-dddd-dddd-dddddddddddd',
    (select agency_a from ctx), '44444444-4444-4444-4444-444444444444')),
  100::bigint, 'tout membre marque faites les tâches d''un dossier qu''il clôt');

select is(pg_temp.open_count('dddddddd-dddd-dddd-dddd-dddddddddddd'), 0::bigint,
  'il ne reste aucune tâche à faire dans le dossier');

select ok(
  (select bool_and(done_by = '44444444-4444-4444-4444-444444444444')
     from public.case_tasks
     where case_id = 'dddddddd-dddd-dddd-dddd-dddddddddddd' and title <> 'Tâche 1'),
  'les tâches cochées à la clôture indiquent qui a clos');

select throws_ok(
  $$select * from public.complete_case_tasks('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222')$$,
  'P0002', null, 'clore les tâches d''un dossier d''une autre agence est refusé');

-- Clôture et tâches en une seule opération : dossier C (tâches à faire)
create temp table open_c as
select id from public.case_tasks
where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and done_at is null;
grant select on open_c to public;

create temp table closed_c as
select * from public.close_case_with_tasks('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'closed');
grant select on closed_c to public;

select is(
  (select previous_status from closed_c), 'active',
  'clôture avec tâches : renvoie l''ancien statut');

select ok(
  (select count(*) from open_c) > 0
    and (select completed_count from closed_c)::bigint = (select count(*) from open_c),
  'clôture avec tâches : renvoie le nombre de tâches cochées');

select ok(
  (select status = 'closed' from public.cases where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc')
    and pg_temp.open_count('cccccccc-cccc-cccc-cccc-cccccccccccc') = 0,
  'clôture avec tâches : dossier clos et plus aucune tâche à faire');

select throws_ok(
  $$select * from public.close_case_with_tasks('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'active')$$,
  '22023', null, 'clôture avec tâches : rouvrir par cette voie est refusé');

select throws_ok(
  $$select * from public.close_case_with_tasks('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'closed')$$,
  'P0002', null, 'clôture avec tâches : dossier d''une autre agence refusé');

select throws_ok(
  $$select * from public.close_case_with_tasks('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '55555555-5555-5555-5555-555555555555', 'abandoned')$$,
  '42501', null, 'clôture avec tâches : membre désactivé refusé');

-- Remis actif pour la suite, tâches rouvertes
update public.cases set status = 'active' where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
update public.case_tasks set done_at = null, done_by = null
where id in (select id from open_c);

-- 7. Même tâche pour plusieurs dossiers -------------------------------------

select is(
  (select count(*) from public.create_cases_task(
    array['cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd',
          'cccccccc-cccc-cccc-cccc-cccccccccccc']::uuid[],
    (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
    'Relancer pour le visa', null, date '2026-11-02', '44444444-4444-4444-4444-444444444444')),
  2::bigint, 'actions groupées : une tâche par dossier, doublons ignorés');

select is(
  (select count(*) from public.case_tasks
    where title = 'Relancer pour le visa' and created_by = '22222222-2222-2222-2222-222222222222'
      and assigned_to = '44444444-4444-4444-4444-444444444444' and due_date = date '2026-11-02'),
  2::bigint, 'les tâches groupées ont toutes le même contenu');

select throws_ok(
  $$select * from public.create_cases_task(
      array['cccccccc-cccc-cccc-cccc-cccccccccccc', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee']::uuid[],
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'Mélange', null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  'P0002', null, 'actions groupées : un dossier d''une autre agence refuse l''ensemble');

select is(
  (select count(*) from public.case_tasks where title = 'Mélange'), 0::bigint,
  'actions groupées refusées : aucune tâche créée');

select throws_ok(
  $$select * from public.create_cases_task('{}'::uuid[], (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'x', null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  '22023', null, 'actions groupées : une liste vide est refusée');

select throws_ok(
  $$select * from public.create_cases_task(
      array['cccccccc-cccc-cccc-cccc-cccccccccccc']::uuid[], (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'x', null, null,
      '55555555-5555-5555-5555-555555555555')$$,
  '22023', null, 'actions groupées : pas de responsable désactivé');

-- 8. Responsable désactivé --------------------------------------------------

update public.profiles set is_active = false where id = '44444444-4444-4444-4444-444444444444';

select lives_ok(
  $$select public.update_case_task(
      (select id from public.case_tasks
        where title = 'Relancer pour le visa' and case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      'Relancer pour le visa (urgent)', null, null, '44444444-4444-4444-4444-444444444444')$$,
  'modifier une tâche en gardant son responsable désactivé reste permis');

select throws_ok(
  $$select public.update_case_task((select id from t2), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'x', null, null,
      '44444444-4444-4444-4444-444444444444')$$,
  '22023', null, 'mais pas la confier à un membre désactivé');

-- 9. Contraintes directes (droits d'administrateur) -------------------------

select throws_ok(
  $$update public.case_tasks set created_by = '11111111-1111-1111-1111-111111111111'
    where id = (select id from t2)$$,
  '42501', null, 'l''auteur d''une tâche ne change pas');

select throws_ok(
  $$update public.case_tasks set done_at = now() where id = (select id from t2)$$,
  '23514', null, 'une tâche faite exige qui l''a faite');

select throws_ok(
  $$insert into public.case_tasks (agency_id, case_id, title, assigned_to, created_by)
    select agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'x',
      '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111' from ctx$$,
  '23503', null, 'le responsable doit être de la même agence que la tâche');

select throws_ok(
  $$insert into public.case_tasks (agency_id, case_id, title, assigned_to, created_by)
    select agency_b, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'x',
      '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333' from ctx$$,
  '23503', null, 'une tâche ne peut pas viser le dossier d''une autre agence');

-- 10. Agence expirée : lecture seule ----------------------------------------

update public.agencies set subscription_ends_at = now() - interval '1 minute'
where id = (select agency_a from ctx);

select throws_ok(
  $$select public.create_case_task('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Refusée', null, null,
      '22222222-2222-2222-2222-222222222222')$$,
  '25006', null, 'expirée : ajouter une tâche est refusé');

select throws_ok(
  $$select public.set_case_task_done((select id from t2), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', true)$$,
  '25006', null, 'expirée : cocher une tâche est refusé');

-- 11. Accès depuis le navigateur --------------------------------------------

-- Patron A
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select ok(
  (select count(*) from public.case_tasks where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc') > 0,
  'le patron voit les tâches de son agence');

select throws_ok(
  $$insert into public.case_tasks (agency_id, case_id, title, assigned_to, created_by)
    select agency_id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Direct', id, id
    from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'un patron n''écrit pas une tâche directement');

select throws_ok(
  $$update public.case_tasks set title = 'Direct'$$,
  '42501', null, 'un patron ne modifie pas une tâche directement');

select throws_ok(
  $$delete from public.case_tasks$$,
  '42501', null, 'un patron ne supprime pas une tâche directement');

select throws_ok(
  $$select public.create_case_task(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
      'x', null, null, gen_random_uuid())$$,
  '42501', null, 'les fonctions des tâches ne s''appellent pas depuis le navigateur');

select throws_ok(
  $$select * from public.create_cases_task('{}'::uuid[], gen_random_uuid(), gen_random_uuid(),
      'x', null, null, gen_random_uuid())$$,
  '42501', null, 'les actions groupées non plus');

-- Patron B
reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.case_tasks
    where case_id in ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd')),
  0::bigint, 'une autre agence ne voit aucune tâche');

-- Visiteur
reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.case_tasks$$,
  '42501', null, 'un visiteur ne peut pas lire les tâches');

select * from finish();
rollback;
