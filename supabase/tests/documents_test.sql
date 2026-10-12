begin;
select plan(20);

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
  (select id from public.campaigns where is_current) as campaign;

insert into public.cases (id, agency_id, campaign_id, created_by, first_name, last_name,
  birth_date, phone, education_level, main_track, scope, pastel_account)
select 'cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a, campaign,
  '11111111-1111-1111-1111-111111111111',
  'Karim', 'A-case', '2004-05-01', '0555111111', 'l3', 'non_dap', 'both', 'to_create'
from ctx;

-- Contraintes (droits d'administrateur)
-- Le test d'insertion valide vient après les refus : une ligne déjà présente
-- ferait réagir la clé primaire avant les autres contraintes.
select throws_ok(
  $$insert into public.documents (id, agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by)
    select 'dddddddd-dddd-dddd-dddd-dddddddddddd', agency_b,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Passeport', 'p.pdf',
      agency_b::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/dddddddd-dddd-dddd-dddd-dddddddddddd.pdf',
      1000, '33333333-3333-3333-3333-333333333333' from ctx$$,
  '23503', null, 'un document ne peut pas être rattaché à un dossier d''une autre agence');

select throws_ok(
  $$insert into public.documents (id, agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by)
    select 'dddddddd-dddd-dddd-dddd-dddddddddddd', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Passeport', 'p.pdf',
      agency_a::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/dddddddd-dddd-dddd-dddd-dddddddddddd.pdf',
      0, '11111111-1111-1111-1111-111111111111' from ctx$$,
  '23514', null, 'un fichier vide est refusé');

select throws_ok(
  $$insert into public.documents (id, agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by)
    select 'dddddddd-dddd-dddd-dddd-dddddddddddd', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Passeport', 'p.pdf',
      agency_a::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/dddddddd-dddd-dddd-dddd-dddddddddddd.pdf',
      10485761, '11111111-1111-1111-1111-111111111111' from ctx$$,
  '23514', null, 'un fichier de plus de 10 Mo est refusé');

select throws_ok(
  $$insert into public.documents (id, agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by)
    select 'dddddddd-dddd-dddd-dddd-dddddddddddd', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', '   ', 'p.pdf',
      agency_a::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/dddddddd-dddd-dddd-dddd-dddddddddddd.pdf',
      1000, '11111111-1111-1111-1111-111111111111' from ctx$$,
  '23514', null, 'un nom vide est refusé');

select throws_ok(
  $$insert into public.documents (id, agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by)
    select 'dddddddd-dddd-dddd-dddd-dddddddddddd', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Passeport', 'p.pdf',
      'chemin-libre/passeport.pdf',
      1000, '11111111-1111-1111-1111-111111111111' from ctx$$,
  '23514', null, 'le chemin de stockage doit suivre le format imposé');

select throws_ok(
  $$insert into public.documents (id, agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by, locked_at)
    select 'dddddddd-dddd-dddd-dddd-dddddddddddd', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Passeport', 'p.pdf',
      agency_a::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/dddddddd-dddd-dddd-dddd-dddddddddddd.pdf',
      1000, '11111111-1111-1111-1111-111111111111', now() from ctx$$,
  '23514', null, 'un verrou doit avoir une date et un auteur');

select lives_ok(
  $$insert into public.documents (id, agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by)
    select 'dddddddd-dddd-dddd-dddd-dddddddddddd', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Passeport', 'p.pdf',
      agency_a::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/dddddddd-dddd-dddd-dddd-dddddddddddd.pdf',
      1000, '11111111-1111-1111-1111-111111111111' from ctx$$,
  'le serveur peut ajouter un document valide');

select throws_ok(
  $$update public.documents set size_bytes = 5
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  '42501', null, 'la taille du fichier n''est pas modifiable');

select lives_ok(
  $$update public.documents set name = 'Passeport du candidat'
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  'un document non verrouillé peut être renommé');

select is(
  (select public from storage.buckets where id = 'case-documents'),
  false, 'le stockage des documents est privé');

-- Patron A
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.documents), 1::bigint,
  'le patron voit les documents de son agence');

select throws_ok(
  $$update public.documents set name = 'x'$$,
  '42501', null, 'un patron ne peut pas modifier un document directement');

select throws_ok(
  $$select public.set_document_lock(
      'dddddddd-dddd-dddd-dddd-dddddddddddd', gen_random_uuid(), gen_random_uuid(), true)$$,
  '42501', null, 'le verrou ne s''appelle pas depuis le navigateur');

-- Employé A
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$delete from public.documents$$,
  '42501', null, 'un employé ne peut pas supprimer un document directement');

-- Patron B
reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.documents), 0::bigint,
  'une autre agence ne voit aucun document');

-- Visiteur
reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.documents$$,
  '42501', null, 'un visiteur ne peut pas lire les documents');

-- Verrou (droits d'administrateur)
reset role;

select throws_ok(
  $$select public.set_document_lock(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', true)$$,
  '42501', null, 'un employé ne peut pas verrouiller un document');

select lives_ok(
  $$select public.set_document_lock(
      'dddddddd-dddd-dddd-dddd-dddddddddddd',
      (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', true)$$,
  'le patron peut verrouiller un document');

select throws_ok(
  $$update public.documents set name = 'Autre nom'
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  '55006', null, 'un document verrouillé ne peut pas être renommé');

select throws_ok(
  $$delete from public.documents
    where id = 'dddddddd-dddd-dddd-dddd-dddddddddddd'$$,
  '55006', null, 'un document verrouillé ne peut pas être supprimé');

select * from finish();
rollback;
