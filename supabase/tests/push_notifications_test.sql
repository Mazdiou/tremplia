begin;
select plan(39);

-- Agence A : patron P, employé E (responsable du dossier 1), employé D
-- (désactivé). Dossier 1 suivi par E, dossier 2 sans responsable, dossier 3
-- dans une campagne archivée. Agence B : patron Q. Administrateur Z (agence C).
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'p@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'e@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'd@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'q@test.local'),
  ('99999999-9999-9999-9999-999999999999', 'z@test.local');

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
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Employe', true),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'Desactive', false)
  ) as v(id, fn, active)
where p.id = '11111111-1111-1111-1111-111111111111';

create temp table ctx as
select
  (select agency_id from public.profiles where id = '11111111-1111-1111-1111-111111111111') as a,
  (select agency_id from public.profiles where id = '33333333-3333-3333-3333-333333333333') as b;
grant select on ctx to public;

create temp table camp as
select public.create_campaign(a, '11111111-1111-1111-1111-111111111111',
  'Campagne A', null, '{}', '[]', '[]', '{}') as active,
  public.create_campaign(a, '11111111-1111-1111-1111-111111111111',
  'Ancienne', null, '{}', '[]', '[]', '{}') as old
from ctx;

select public.create_case(v.id, ctx.a, '11111111-1111-1111-1111-111111111111', v.campaign, v.assigned,
  format('{"first_name": "%s", "last_name": "C", "birth_date": "2004-05-01",
    "phone": "0555111111", "education_level": "l3"}', v.fn)::jsonb, null, null, null)
from ctx, (values
  ('c1111111-1111-1111-1111-111111111111'::uuid, (select active from camp),
    '22222222-2222-2222-2222-222222222222'::uuid, 'Un'),
  ('c2222222-2222-2222-2222-222222222222'::uuid, (select active from camp), null::uuid, 'Deux'),
  ('c3333333-3333-3333-3333-333333333333'::uuid, (select old from camp), null::uuid, 'Trois')
) as v(id, campaign, assigned, fn);

select public.enable_student_access('c1111111-1111-1111-1111-111111111111', a,
  '11111111-1111-1111-1111-111111111111', repeat('a', 64), 'chiffre', 1::smallint) from ctx;

-- Clés de chiffrement factices, assez longues pour les contrôles
create function pg_temp.save(p_user uuid, p_case uuid, p_generation integer, p_n text)
returns void language sql as $$
  select public.save_push_subscription(
    (select a from ctx), p_user, p_case, p_generation,
    'https://push.test/' || p_n, repeat('k', 40), repeat('s', 16))
$$;


-- 1. Droits ----------------------------------------------------------------------

select ok((select relrowsecurity from pg_class where oid = 'public.push_subscriptions'::regclass),
  'RLS sur les appareils');
select ok((select relrowsecurity from pg_class where oid = 'public.notification_preferences'::regclass),
  'RLS sur les choix');
select ok(not has_table_privilege('authenticated', 'public.push_subscriptions', 'select'),
  'un membre connecté ne lit pas les appareils');
select ok(not has_table_privilege('anon', 'public.notification_preferences', 'select'),
  'un visiteur ne lit pas les choix');
select ok(not has_table_privilege('service_role', 'public.push_subscriptions', 'insert'),
  'le serveur écrit les appareils par la fonction seulement');
select ok(not has_function_privilege('authenticated',
  'public.save_push_subscription(uuid, uuid, uuid, integer, text, text, text)', 'execute'),
  'un membre connecté n''enregistre pas d''appareil lui-même');
select ok(not has_function_privilege('anon', 'public.push_targets_student(uuid, uuid)', 'execute'),
  'un visiteur ne lit pas les destinataires');
select ok(not has_function_privilege('authenticated', 'public.claim_task_digests(date)', 'execute'),
  'un membre connecté ne lance pas le récapitulatif');

-- 2. Enregistrement -----------------------------------------------------------------

select lives_ok($$select pg_temp.save('11111111-1111-1111-1111-111111111111', null, null, 'p1')$$,
  'appareil du patron');
select lives_ok($$select pg_temp.save('22222222-2222-2222-2222-222222222222', null, null, 'e1')$$,
  'appareil de l''employé');
select throws_ok($$select pg_temp.save('44444444-4444-4444-4444-444444444444', null, null, 'd1')$$,
  '42501', null, 'un employé désactivé n''enregistre pas d''appareil');
select throws_ok($$select pg_temp.save('33333333-3333-3333-3333-333333333333', null, null, 'q1')$$,
  '42501', null, 'un membre d''une autre agence est refusé');
select throws_ok($$select pg_temp.save(null, null, null, 'x')$$,
  '22023', null, 'ni membre ni dossier : refusé');
select throws_ok(
  $$select pg_temp.save('11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 1, 'x')$$,
  '22023', null, 'membre et dossier à la fois : refusé');
select throws_ok($$select pg_temp.save(null, 'c1111111-1111-1111-1111-111111111111', 7, 's0')$$,
  '42501', null, 'candidat avec un ancien accès : refusé');
select throws_ok($$select pg_temp.save(null, 'c2222222-2222-2222-2222-222222222222', 1, 's0')$$,
  '42501', null, 'candidat sans accès ouvert : refusé');
select lives_ok(
  $$select pg_temp.save(null, 'c1111111-1111-1111-1111-111111111111',
    (select generation from public.case_student_access where case_id = 'c1111111-1111-1111-1111-111111111111'), 's1')$$,
  'appareil du candidat');
select throws_ok(
  $$select public.save_push_subscription((select a from ctx), '11111111-1111-1111-1111-111111111111',
    null, null, 'http://push.test/x', repeat('k', 40), repeat('s', 16))$$,
  '23514', null, 'adresse non chiffrée (http) refusée');

-- Appareil partagé : le même appareil passe au patron
select pg_temp.save('11111111-1111-1111-1111-111111111111', null, null, 'e1');
select is((select user_id from public.push_subscriptions where endpoint = 'https://push.test/e1'),
  '11111111-1111-1111-1111-111111111111'::uuid, 'un appareil déjà connu change de propriétaire');
select pg_temp.save('22222222-2222-2222-2222-222222222222', null, null, 'e1');

-- Au plus 10 appareils par membre : le plus ancien part
select pg_temp.save('11111111-1111-1111-1111-111111111111', null, null, 'p' || n)
from generate_series(2, 11) n;
select is((select count(*) from public.push_subscriptions
  where user_id = '11111111-1111-1111-1111-111111111111'), 10::bigint, '10 appareils au plus par membre');
select is((select count(*) from public.push_subscriptions where endpoint = 'https://push.test/p1'),
  0::bigint, 'le plus ancien appareil est retiré');
delete from public.push_subscriptions
where user_id = '11111111-1111-1111-1111-111111111111' and endpoint <> 'https://push.test/p11';

-- 3. Destinataires --------------------------------------------------------------------

select is(
  (select array_agg(endpoint) from public.push_targets_case((select a from ctx),
    'c1111111-1111-1111-1111-111111111111', 'student_message')),
  array['https://push.test/e1'], 'message d''un dossier suivi : son responsable seulement');
select is(
  (select array_agg(endpoint) from public.push_targets_case((select a from ctx),
    'c2222222-2222-2222-2222-222222222222', 'student_message')),
  array['https://push.test/p11'], 'dossier sans responsable : le patron');
select throws_ok(
  $$select * from public.push_targets_case((select a from ctx), 'c1111111-1111-1111-1111-111111111111', 'autre')$$,
  '22023', null, 'événement inconnu refusé');
select is(
  (select count(*) from public.push_targets_case((select b from ctx),
    'c1111111-1111-1111-1111-111111111111', 'student_message')),
  0::bigint, 'rien pour un dossier lu depuis une autre agence');

-- L'employé coupe les messages mais garde les réponses
select public.save_notification_preferences((select a from ctx),
  '22222222-2222-2222-2222-222222222222', false, true, true, false);
select is(
  (select count(*) from public.push_targets_case((select a from ctx),
    'c1111111-1111-1111-1111-111111111111', 'student_message')),
  0::bigint, 'messages coupés : plus rien');
select is(
  (select count(*) from public.push_targets_case((select a from ctx),
    'c1111111-1111-1111-1111-111111111111', 'student_review')),
  1::bigint, 'les réponses restent');
select throws_ok(
  $$select public.save_notification_preferences((select a from ctx),
    '44444444-4444-4444-4444-444444444444', true, true, true, true)$$,
  '42501', null, 'un employé désactivé ne change pas ses choix');

-- Responsable désactivé : le patron reprend le relais
update public.profiles set is_active = false where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select array_agg(endpoint) from public.push_targets_case((select a from ctx),
    'c1111111-1111-1111-1111-111111111111', 'student_review')),
  array['https://push.test/p11'], 'responsable désactivé : le patron est prévenu');
select is(
  (select count(*) from public.push_targets_assigned_task((select a from ctx),
    '22222222-2222-2222-2222-222222222222')), 0::bigint, 'un employé désactivé ne reçoit rien');
update public.profiles set is_active = true where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select count(*) from public.push_targets_assigned_task((select a from ctx),
    '22222222-2222-2222-2222-222222222222')), 1::bigint, 'tâche confiée : l''employé est prévenu');

-- Candidat : nouveau code → l'ancien appareil ne reçoit plus rien
select is(
  (select array_agg(endpoint) from public.push_targets_student((select a from ctx),
    'c1111111-1111-1111-1111-111111111111')),
  array['https://push.test/s1'], 'message de l''agence : l''appareil du candidat');
update public.case_student_access set generation = generation + 1
where case_id = 'c1111111-1111-1111-1111-111111111111';
select is(
  (select count(*) from public.push_targets_student((select a from ctx),
    'c1111111-1111-1111-1111-111111111111')), 0::bigint, 'nouveau code : plus rien pour l''ancien accès');

-- 4. Récapitulatif du matin -------------------------------------------------------------

-- Patron : une tâche du jour (dossier 2), une en retard (dossier 2), une dans
-- la campagne archivée, une faite, une pour plus tard
select public.create_case_task(v.c, ctx.a, '11111111-1111-1111-1111-111111111111', v.t, null,
  v.due, '11111111-1111-1111-1111-111111111111')
from ctx, (values
  ('c2222222-2222-2222-2222-222222222222'::uuid, 'Du jour', date '2026-10-23'),
  ('c2222222-2222-2222-2222-222222222222'::uuid, 'En retard', date '2026-10-20'),
  ('c2222222-2222-2222-2222-222222222222'::uuid, 'Faite', date '2026-10-22'),
  ('c2222222-2222-2222-2222-222222222222'::uuid, 'Plus tard', date '2026-10-30'),
  ('c3333333-3333-3333-3333-333333333333'::uuid, 'Archivée', date '2026-10-23')
) as v(c, t, due);
update public.case_tasks set done_at = now(), done_by = '11111111-1111-1111-1111-111111111111'
where title = 'Faite';
update public.campaigns set status = 'archived' where id = (select old from camp);

-- Seuls les membres de ce test comptent (la base peut contenir d'autres agences)
create temp table mine as select '11111111-1111-1111-1111-111111111111'::uuid as id;
grant select on mine to public;
select is((select count(*) from public.claim_task_digests('2026-10-23') d
  where d.user_id in (select id from mine)), 0::bigint,
  'récapitulatif non demandé : rien');
select public.save_notification_preferences((select a from ctx),
  '11111111-1111-1111-1111-111111111111', true, true, true, true);
select results_eq(
  $$select user_id, due_today, overdue from public.claim_task_digests('2026-10-23')
    where user_id in (select id from mine)$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid, 1, 1)$$,
  'récapitulatif : une du jour, une en retard (ni faite, ni archivée, ni plus tard)');
select is((select count(*) from public.claim_task_digests('2026-10-23') d
  where d.user_id in (select id from mine)), 0::bigint,
  'un seul récapitulatif par jour');
select is((select count(*) from public.claim_task_digests('2026-10-24') d
  where d.user_id in (select id from mine)), 1::bigint,
  'le lendemain, de nouveau');

-- 5. Suppression de l'agence : appareils et choix partent avec elle -----------------------

select public.delete_agency('99999999-9999-9999-9999-999999999999', a) from ctx;
select is((select count(*) from public.push_subscriptions where agency_id = (select a from ctx)),
  0::bigint, 'appareils supprimés avec l''agence');
select is((select count(*) from public.notification_preferences where agency_id = (select a from ctx)),
  0::bigint, 'choix supprimés avec l''agence');

select * from finish();
rollback;
