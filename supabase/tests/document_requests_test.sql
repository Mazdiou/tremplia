begin;
select plan(68);

-- Agence A : patron (1111), employé (2222), employé désactivé (5555) ;
-- agence B : patron (3333)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a2@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'a3@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');
select public.create_agency_with_owner(
  '33333333-3333-3333-3333-333333333333', 'Agence B', 'Oran', '0555000002', 'Patron', 'B');

insert into public.profiles (id, agency_id, first_name, last_name, role, is_active)
select v.id, p.agency_id, v.fn, 'A', 'employee', v.active
from public.profiles p,
  (values
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Employe', true),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'Ancien', false)
  ) as v(id, fn, active)
where p.id = '11111111-1111-1111-1111-111111111111';

create temp table ctx as
select
  (select agency_id from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') as agency_a,
  (select agency_id from public.profiles
    where id = '33333333-3333-3333-3333-333333333333') as agency_b;
grant select on ctx to public;

-- Dossier de l'agence A (cccc) et de l'agence B (bbbb), avec leurs dossiers
-- de rangement de départ
select public.create_case('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '11111111-1111-1111-1111-111111111111',
  public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
    'Campagne A', null, '{}', '[]', '[]', '{}'),
  null,
  '{"first_name": "Karim", "last_name": "A-case", "birth_date": "2004-05-01",
    "phone": "0555111111", "education_level": "l3"}',
  null, null, null)
from ctx;
select public.create_case('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', agency_b,
  '33333333-3333-3333-3333-333333333333',
  public.create_campaign(agency_b, '33333333-3333-3333-3333-333333333333',
    'Campagne B', null, '{}', '[]', '[]', '{}'),
  null,
  '{"first_name": "Sara", "last_name": "B-case", "birth_date": "2003-02-01",
    "phone": "0555222222", "education_level": "l2"}',
  null, null, null)
from ctx;
select public.ensure_default_document_folders('cccccccc-cccc-cccc-cccc-cccccccccccc',
  agency_a, '11111111-1111-1111-1111-111111111111') from ctx;
select public.ensure_default_document_folders('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  agency_b, '33333333-3333-3333-3333-333333333333') from ctx;

create function pg_temp.folder(c uuid, n text) returns uuid language sql as $$
  select id from public.document_folders where case_id = c and name = n $$;

-- Pièce demandée au dossier A (employé par défaut)
create function pg_temp.ask(label text, folder uuid default null,
  actor uuid default '22222222-2222-2222-2222-222222222222') returns uuid
language sql as $$
  select public.create_document_request('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), actor, label, folder) $$;
create function pg_temp.req(label text) returns uuid language sql as $$
  select id from public.case_document_requests
  where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and label = $1 $$;
create function pg_temp.req_doc(label text) returns uuid language sql as $$
  select document_id from public.case_document_requests
  where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and label = $1 $$;
create function pg_temp.accept(label text, accepted boolean default true,
  doc uuid default null) returns boolean language sql as $$
  select public.set_document_request_accepted(pg_temp.req(label),
    'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222',
    coalesce(doc, pg_temp.req_doc(label)), accepted) $$;

-- Envoi du candidat du dossier A
create function pg_temp.prep(req uuid, gen integer default 1) returns uuid
language sql as $$
  select document_id from public.student_prepare_document(
    'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx), gen, req) $$;
create function pg_temp.add(doc uuid, gen integer default 1) returns text
language sql as $$
  select public.student_add_document('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), gen, doc, 'scan.pdf', 2048) $$;
create function pg_temp.remove(req uuid) returns text language sql as $$
  select public.student_remove_document('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), 1, req) $$;
create function pg_temp.path(doc uuid) returns text language sql as $$
  select (select agency_a from ctx)::text
    || '/cccccccc-cccc-cccc-cccc-cccccccccccc/' || doc::text || '.pdf' $$;

-- 1. Pièces demandées par l'agence

select isnt(
  pg_temp.ask('Passeport', pg_temp.folder('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Visa')),
  null, 'un employé demande une pièce, rangée dans un dossier');
select isnt(pg_temp.ask('Relevé de notes'), null, 'une pièce sans dossier de rangement');
select is(
  (select created_by from public.case_document_requests where id = pg_temp.req('Passeport')),
  '22222222-2222-2222-2222-222222222222'::uuid, 'l''auteur de la demande est gardé');

select throws_ok($$select pg_temp.ask('Photo', null, '55555555-5555-5555-5555-555555555555')$$,
  '42501', null, 'un employé désactivé ne demande rien');
select throws_ok($$select pg_temp.ask('Photo', null, '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'un membre d''une autre agence ne demande rien');
select throws_ok(
  $$select public.create_document_request('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333', 'Photo', null)$$,
  'P0002', null, 'une agence ne demande rien sur le dossier d''une autre');
select throws_ok($$select pg_temp.ask('PASSEPORT')$$,
  '23505', null, 'un intitulé par dossier, majuscules ignorées');
select throws_ok($$select pg_temp.ask(' Photo')$$,
  '23514', null, 'un intitulé avec des espaces autour est refusé');
select throws_ok($$select pg_temp.ask(repeat('x', 81))$$,
  '23514', null, 'un intitulé de plus de 80 caractères est refusé');
select throws_ok(
  $$select pg_temp.ask('Photo', pg_temp.folder('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Visa'))$$,
  '23503', null, 'le dossier de rangement est celui de ce candidat');

select is(
  public.update_document_request(pg_temp.req('Relevé de notes'),
    'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111', 'Relevés de notes',
    pg_temp.folder('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Candidature')),
  true, 'la pièce est renommée et rangée ailleurs');
select is(
  public.update_document_request(pg_temp.req('Relevés de notes'),
    'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111', 'Relevés de notes',
    pg_temp.folder('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Candidature')),
  false, 'sans changement, rien n''est écrit');
select throws_ok(
  $$select public.update_document_request(pg_temp.req('Passeport'),
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'X', null)$$,
  'P0002', null, 'une pièce se modifie seulement dans son dossier');
select throws_ok($$select pg_temp.accept('Passeport')$$,
  '23514', null, 'une pièce en attente ne s''accepte pas');

-- 30 pièces au plus par dossier (dossier B)
select is(
  (select count(public.create_document_request('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     (select agency_b from ctx), '33333333-3333-3333-3333-333333333333', 'Pièce ' || n, null))
   from generate_series(1, 30) n),
  30::bigint, '30 pièces demandées');
select throws_ok(
  $$select public.create_document_request('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      (select agency_b from ctx), '33333333-3333-3333-3333-333333333333', 'Une de trop', null)$$,
  '54000', null, 'la 31e pièce est refusée');

-- 2. Envoi du candidat

select throws_ok($$select pg_temp.prep(pg_temp.req('Passeport'))$$,
  '42501', null, 'rien ne s''envoie tant que l''accès est fermé');

select public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
  repeat('a', 64), 'chiffre', 1::smallint);

select throws_ok($$select pg_temp.prep(pg_temp.req('Passeport'), 2)$$,
  '42501', null, 'une ancienne session (autre génération) n''envoie rien');
select throws_ok(
  $$select pg_temp.prep((select id from public.case_document_requests
      where case_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' limit 1))$$,
  'P0002', null, 'le candidat n''envoie rien pour la pièce d''un autre dossier');
select throws_ok($$select pg_temp.add(gen_random_uuid())$$,
  '22023', null, 'un envoi qui n''a pas été préparé est refusé');

create temp table sent (step text primary key, doc uuid);
grant all on sent to public;
insert into sent values ('first', pg_temp.prep(pg_temp.req('Passeport')));

select is(pg_temp.add((select doc from sent where step = 'first')), null,
  'premier envoi : aucun document remplacé');
select is(pg_temp.req_doc('Passeport'), (select doc from sent where step = 'first'),
  'la pièce est reçue');
select results_eq(
  $$select name, folder_id, uploaded_by, sent_by_student, storage_path, size_bytes
    from public.documents where id = (select doc from sent where step = 'first')$$,
  $$select 'Passeport'::text,
      pg_temp.folder('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Visa'),
      null::uuid, true, pg_temp.path((select doc from sent where step = 'first')),
      2048::bigint$$,
  'le document porte le nom de la pièce, son dossier, et vient du candidat');
select throws_ok($$select pg_temp.add((select doc from sent where step = 'first'))$$,
  '22023', null, 'un envoi ne se confirme qu''une fois');
select is(
  (select has_document from public.onboarding_progress((select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111')),
  false, 'le guide de démarrage ne compte pas les documents du candidat');

-- Remplacement
insert into sent values ('second', pg_temp.prep(pg_temp.req('Passeport')));
select is(pg_temp.add((select doc from sent where step = 'second')),
  pg_temp.path((select doc from sent where step = 'first')),
  'le remplacement renvoie le fichier à supprimer');
select is(pg_temp.req_doc('Passeport'), (select doc from sent where step = 'second'),
  'la pièce pointe vers le nouveau document');
select is(
  (select count(*) from public.documents where id = (select doc from sent where step = 'first')),
  0::bigint, 'l''ancien document est supprimé');

-- 3. Acceptation

select throws_ok(
  $$select pg_temp.accept('Passeport', true, (select doc from sent where step = 'first'))$$,
  '55000', null, 'un document déjà remplacé ne s''accepte pas');
select is(pg_temp.accept('Passeport'), true, 'un employé accepte la pièce');
select is(pg_temp.accept('Passeport'), false, 'déjà acceptée : rien ne change');
select is(
  (select accepted_by from public.case_document_requests where id = pg_temp.req('Passeport')),
  '22222222-2222-2222-2222-222222222222'::uuid, 'l''auteur de l''acceptation est gardé');
select throws_ok($$select pg_temp.prep(pg_temp.req('Passeport'))$$,
  '55006', null, 'une pièce acceptée ne se remplace plus');
select throws_ok($$select pg_temp.remove(pg_temp.req('Passeport'))$$,
  '55006', null, 'une pièce acceptée ne se retire plus');
select is(pg_temp.accept('Passeport', false), true, 'l''agence revient sur son acceptation');

-- Document verrouillé par le patron : le candidat n'y touche plus non plus
select public.set_document_lock(pg_temp.req_doc('Passeport'), (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', true);
select throws_ok($$select pg_temp.prep(pg_temp.req('Passeport'))$$,
  '55006', null, 'un document verrouillé ne se remplace pas');
select throws_ok($$select pg_temp.remove(pg_temp.req('Passeport'))$$,
  '55006', null, 'un document verrouillé ne se retire pas');
select public.set_document_lock(pg_temp.req_doc('Passeport'), (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', false);

-- 4. Retrait par le candidat

select is(pg_temp.remove(pg_temp.req('Passeport')),
  pg_temp.path((select doc from sent where step = 'second')),
  'le retrait renvoie le fichier à supprimer');
select is(pg_temp.req_doc('Passeport'), null, 'la pièce repasse en attente');
select is(pg_temp.remove(pg_temp.req('Passeport')), null, 'rien à retirer : rien ne se passe');

-- Le candidat ne touche jamais à un document de l'agence
insert into public.documents (id, agency_id, case_id, name, original_file_name,
  storage_path, size_bytes, uploaded_by)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', agency_a,
  'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Contrat', 'c.pdf',
  pg_temp.path('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'), 1000,
  '11111111-1111-1111-1111-111111111111' from ctx;
update public.case_document_requests set document_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
where id = pg_temp.req('Passeport');
select throws_ok($$select pg_temp.remove(pg_temp.req('Passeport'))$$,
  '42501', null, 'le candidat ne retire pas un document de l''agence');
insert into sent values ('third', pg_temp.prep(pg_temp.req('Passeport')));
select throws_ok($$select pg_temp.add((select doc from sent where step = 'third'))$$,
  '42501', null, 'le candidat ne remplace pas un document de l''agence');
update public.case_document_requests set document_id = null
where id = pg_temp.req('Passeport');

-- 5. Côté agence : document supprimé, pièce retirée

select pg_temp.add((select doc from sent where step = 'third'));
select pg_temp.accept('Passeport');
delete from public.documents where id = (select doc from sent where step = 'third');
select results_eq(
  $$select document_id, accepted_at, accepted_by from public.case_document_requests
    where id = pg_temp.req('Passeport')$$,
  $$values (null::uuid, null::timestamptz, null::uuid)$$,
  'document supprimé par l''agence : la pièce repasse en attente, non acceptée');

insert into sent values ('fourth', pg_temp.prep(pg_temp.req('Relevés de notes')));
select pg_temp.add((select doc from sent where step = 'fourth'));
select is(
  (select folder_id from public.documents where id = (select doc from sent where step = 'fourth')),
  pg_temp.folder('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Candidature'),
  'le document va dans le dossier de rangement choisi');
select lives_ok(
  $$select public.delete_document_request(pg_temp.req('Relevés de notes'),
      'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  'un employé retire une pièce demandée');
select is(
  (select count(*) from public.documents where id = (select doc from sent where step = 'fourth')),
  1::bigint, 'le document reçu reste dans le dossier');
select throws_ok(
  $$select public.delete_document_request(gen_random_uuid(),
      'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  'P0002', null, 'une pièce inconnue ne se retire pas');

-- Pièce retirée pendant un envoi
select pg_temp.ask('Photo');
insert into sent values ('fifth', pg_temp.prep(pg_temp.req('Photo')));
select public.delete_document_request(pg_temp.req('Photo'),
  'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx),
  '22222222-2222-2222-2222-222222222222');
select throws_ok($$select pg_temp.add((select doc from sent where step = 'fifth'))$$,
  'P0002', null, 'une pièce retirée pendant l''envoi ne reçoit rien');

-- 6. Règles des documents

select throws_ok(
  $$insert into public.documents (agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by, sent_by_student)
    select agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'X', 'x.pdf',
      pg_temp.path('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'), 10, null, false from ctx$$,
  '23514', null, 'un document a toujours un auteur : un membre ou le candidat');
select throws_ok(
  $$update public.documents set sent_by_student = false
    where id = (select doc from sent where step = 'fourth')$$,
  '42501', null, 'l''origine d''un document ne change pas');

-- 7. Envois préparés : nettoyage et limite

insert into public.student_document_uploads (document_id, agency_id, case_id, request_id, created_at)
select 'ffffffff-ffff-ffff-ffff-ffffffffffff', agency_a,
  'cccccccc-cccc-cccc-cccc-cccccccccccc', null, now() - interval '2 days' from ctx;
select is(
  (select stale_paths from public.student_prepare_document(
     'cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx), 1,
     pg_temp.req('Passeport'))),
  array[pg_temp.path('ffffffff-ffff-ffff-ffff-ffffffffffff')],
  'un envoi jamais confirmé depuis un jour est à supprimer du stockage');
select is(
  (select count(*) from public.student_document_uploads
   where document_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'),
  0::bigint, 'et il est oublié');

insert into public.student_document_uploads (document_id, agency_id, case_id, request_id)
select gen_random_uuid(), agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc', null
from ctx, generate_series(1, 20 - (
  select count(*) from public.student_document_uploads
  where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    and created_at > now() - interval '1 hour')::integer);
select throws_ok($$select pg_temp.prep(pg_temp.req('Passeport'))$$,
  '54000', null, '20 envois préparés par heure au plus');
delete from public.student_document_uploads where request_id is null;

-- 8. Notifications

select lives_ok(
  $$select * from public.push_targets_case((select agency_a from ctx),
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'student_document')$$,
  'nouvel événement : pièce envoyée par le candidat');
select throws_ok(
  $$select * from public.push_targets_case((select agency_a from ctx),
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'autre')$$,
  '22023', null, 'un événement inconnu est refusé');
select public.save_notification_preferences((select agency_a from ctx),
  '22222222-2222-2222-2222-222222222222', true, true, true, false, false);
select is(
  (select student_documents from public.notification_preferences
   where user_id = '22222222-2222-2222-2222-222222222222'),
  false, 'un membre coupe les notifications de pièces');
select public.save_notification_preferences((select agency_a from ctx),
  '22222222-2222-2222-2222-222222222222', true, false, true, false);
select results_eq(
  $$select student_reviews, student_documents from public.notification_preferences
    where user_id = '22222222-2222-2222-2222-222222222222'$$,
  $$values (false, false)$$,
  'sans ce choix, l''ancien appel garde la valeur enregistrée');

-- 9. Lecture par le navigateur

select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.case_document_requests), 1::bigint,
  'un membre voit les pièces demandées de son agence');
select throws_ok(
  $$insert into public.case_document_requests (agency_id, case_id, label)
    select agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'X' from ctx$$,
  '42501', null, 'le navigateur ne crée pas de pièce directement');
select throws_ok(
  $$update public.case_document_requests set accepted_at = now()$$,
  '42501', null, 'le navigateur n''accepte pas de pièce directement');
select throws_ok(
  $$select pg_temp.ask('Visa')$$,
  '42501', null, 'le navigateur n''appelle pas les fonctions des pièces');
select throws_ok(
  $$select pg_temp.prep(pg_temp.req('Passeport'))$$,
  '42501', null, 'le navigateur n''appelle pas les fonctions du candidat');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.case_document_requests), 30::bigint,
  'une autre agence ne voit que ses propres pièces');

reset role;

-- 10. Abonnement expiré : lecture seule

update public.agencies set subscription_ends_at = now() - interval '1 minute'
where id = (select agency_a from ctx);
select throws_ok($$select pg_temp.ask('Visa')$$,
  '25006', null, 'expirée : demander une pièce est refusé');
select throws_ok($$select pg_temp.prep(pg_temp.req('Passeport'))$$,
  '25006', null, 'expirée : le candidat n''envoie rien');
select throws_ok($$select pg_temp.remove(pg_temp.req('Passeport'))$$,
  '25006', null, 'expirée : le candidat ne retire rien');

-- 11. Suppression d'une agence : ses pièces et envois partent avec elle

select public.enable_student_access('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  (select agency_b from ctx), '33333333-3333-3333-3333-333333333333',
  repeat('b', 64), 'chiffre', 1::smallint);
select public.student_add_document('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', agency_b, 1,
  (select document_id from public.student_prepare_document('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
     agency_b, 1, (select id from public.case_document_requests
                   where case_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' and label = 'Pièce 1'))),
  'b.pdf', 100)
from ctx;
select set_config('tremplia.purge', 'on', true);
select lives_ok(
  $$delete from public.agencies where id = (select agency_b from ctx)$$,
  'l''agence est supprimée avec ses pièces et le document du candidat');
select set_config('tremplia.purge', 'off', true);
select is(
  (select count(*) from public.case_document_requests
   where case_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  0::bigint, 'plus aucune pièce de l''agence supprimée');

select * from finish();
rollback;
