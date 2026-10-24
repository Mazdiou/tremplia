begin;
select plan(63);

-- Agence A : patron (1111), employé (2222) ; agence B : patron (3333)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a1@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a2@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'b1@test.local');

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

-- Dossier candidat de l'agence A (cccc) et de l'agence B (bbbb)
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

-- Documents

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

-- Dossiers de documents

reset role;

-- Contraintes (droits d'administrateur)
select throws_ok(
  $$insert into public.document_folders (agency_id, case_id, name)
    select agency_b, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Banque' from ctx$$,
  '23503', null, 'un dossier de documents ne peut pas viser le dossier d''une autre agence');

select throws_ok(
  $$insert into public.document_folders (agency_id, case_id, name)
    select agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc', '   ' from ctx$$,
  '23514', null, 'un nom vide est refusé');

select throws_ok(
  $$insert into public.document_folders (agency_id, case_id, name)
    select agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc', ' Banque' from ctx$$,
  '23514', null, 'un nom avec des espaces autour est refusé');

select throws_ok(
  $$insert into public.document_folders (agency_id, case_id, name)
    select agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc', repeat('x', 81) from ctx$$,
  '23514', null, 'un nom de plus de 80 caractères est refusé');

select lives_ok(
  $$insert into public.document_folders (id, agency_id, case_id, name, created_by)
    select 'f1111111-1111-1111-1111-111111111111', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Banque',
      '11111111-1111-1111-1111-111111111111' from ctx$$,
  'le serveur peut ajouter un dossier de documents valide');

select throws_ok(
  $$insert into public.document_folders (agency_id, case_id, name)
    select agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'BANQUE' from ctx$$,
  '23505', null, 'deux dossiers du même nom (majuscules comprises) sont refusés');

select lives_ok(
  $$insert into public.document_folders (id, agency_id, case_id, name)
    select 'f2222222-2222-2222-2222-222222222222', agency_b,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Banque' from ctx$$,
  'le même nom est permis dans un autre dossier candidat');

-- Rangement des documents
select throws_ok(
  $$insert into public.documents (id, agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by, folder_id)
    select 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Relevé', 'r.pdf',
      agency_a::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee.pdf',
      1000, '11111111-1111-1111-1111-111111111111',
      'f2222222-2222-2222-2222-222222222222' from ctx$$,
  '23503', null, 'un document ne peut pas être rangé dans le dossier d''un autre candidat');

select lives_ok(
  $$insert into public.documents (id, agency_id, case_id, name, original_file_name,
      storage_path, size_bytes, uploaded_by, folder_id)
    select 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Relevé', 'r.pdf',
      agency_a::text || '/cccccccc-cccc-cccc-cccc-cccccccccccc/eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee.pdf',
      1000, '11111111-1111-1111-1111-111111111111',
      'f1111111-1111-1111-1111-111111111111' from ctx$$,
  'un document peut être rangé dans un dossier du même candidat');

select lives_ok(
  $$update public.document_folders set name = 'Banque et études'
    where id = 'f1111111-1111-1111-1111-111111111111'$$,
  'un dossier de documents peut être renommé');

select throws_ok(
  $$update public.document_folders
    set case_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    where id = 'f1111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'un dossier de documents ne change pas de dossier candidat');

-- Suppression : le document survit, il passe dans « Sans dossier »
select lives_ok(
  $$delete from public.document_folders
    where id = 'f1111111-1111-1111-1111-111111111111'$$,
  'supprimer un dossier de documents sans verrou est possible');

select is(
  (select count(*) from public.documents
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' and folder_id is null),
  1::bigint, 'le document survit et passe dans « Sans dossier »');

-- Déplacement et verrou
select lives_ok(
  $$insert into public.document_folders (id, agency_id, case_id, name)
    select 'f3333333-3333-3333-3333-333333333333', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Visa' from ctx$$,
  'création du dossier « Visa »');

select lives_ok(
  $$update public.documents set folder_id = 'f3333333-3333-3333-3333-333333333333'
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  'un document non verrouillé peut être déplacé');

select lives_ok(
  $$select public.set_document_lock(
      'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', true)$$,
  'le patron verrouille le document');

select throws_ok(
  $$update public.documents set folder_id = null
    where id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  '55006', null, 'un document verrouillé ne peut pas être déplacé');

select throws_ok(
  $$delete from public.document_folders
    where id = 'f3333333-3333-3333-3333-333333333333'$$,
  '55006', null, 'un dossier qui contient un document verrouillé ne peut pas être supprimé');

-- Fonction de suppression
select throws_ok(
  $$select public.delete_document_folder(
      'f3333333-3333-3333-3333-333333333333',
      (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'un employé ne peut pas supprimer un dossier de documents');

select throws_ok(
  $$select public.delete_document_folder(
      'f3333333-3333-3333-3333-333333333333',
      (select agency_a from ctx),
      '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'le patron d''une autre agence ne peut pas supprimer ce dossier');

select throws_ok(
  $$select public.delete_document_folder(
      'f3333333-3333-3333-3333-333333333333',
      (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  '55006', null, 'même le patron ne supprime pas un dossier avec un document verrouillé');

select lives_ok(
  $$insert into public.document_folders (id, agency_id, case_id, name)
    select 'f4444444-4444-4444-4444-444444444444', agency_a,
      'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Temporaire' from ctx$$,
  'création d''un dossier vide');

select lives_ok(
  $$select public.delete_document_folder(
      'f4444444-4444-4444-4444-444444444444',
      (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  'le patron supprime un dossier de documents');

select throws_ok(
  $$select public.delete_document_folder(
      'f4444444-4444-4444-4444-444444444444',
      (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  'P0002', null, 'supprimer un dossier inexistant est refusé');

-- Dossiers de départ
select is(
  public.ensure_default_document_folders(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222'),
  true, 'les dossiers de départ sont créés à la première ouverture');

select is(
  (select count(*) from public.document_folders
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  3::bigint, 'un dossier « Visa » déjà présent est conservé, les 2 autres sont ajoutés');

select is(
  (select array_agg(name order by created_at) from public.document_folders
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
      and name <> 'Visa'),
  array['Candidature', 'Informations personnelles'],
  'les dossiers de départ sont dans l''ordre prévu');

select is(
  public.ensure_default_document_folders(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222'),
  false, 'un second appel ne crée rien');

select lives_ok(
  $$delete from public.document_folders
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc' and name = 'Candidature'$$,
  'l''agence supprime un dossier de départ');

select is(
  public.ensure_default_document_folders(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222'),
  false, 'un dossier de départ supprimé n''est pas recréé');

select is(
  (select count(*) from public.document_folders
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  2::bigint, 'il reste bien 2 dossiers après la suppression');

select throws_ok(
  $$select public.ensure_default_document_folders(
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx),
      '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'un utilisateur d''une autre agence ne peut pas lancer la création');

select throws_ok(
  $$select public.ensure_default_document_folders(
      gen_random_uuid(),
      (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  'P0002', null, 'un dossier candidat inconnu est refusé');

-- Patron A
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.document_folders), 2::bigint,
  'le patron voit les dossiers de documents de son agence, pas ceux des autres');

select throws_ok(
  $$insert into public.document_folders (agency_id, case_id, name)
    select agency_id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Direct'
    from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'un patron ne crée pas de dossier de documents directement');

select throws_ok(
  $$select public.delete_document_folder(gen_random_uuid(), gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, 'la suppression ne s''appelle pas depuis le navigateur');

-- Employé A
reset role;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.document_folders), 2::bigint,
  'un employé voit les dossiers de documents de son agence');

select throws_ok(
  $$delete from public.document_folders$$,
  '42501', null, 'un employé ne supprime pas un dossier de documents directement');

select throws_ok(
  $$select public.ensure_default_document_folders(
      gen_random_uuid(), gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, 'la création des dossiers de départ ne s''appelle pas depuis le navigateur');

-- Patron B
reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.document_folders), 1::bigint,
  'une autre agence ne voit que ses propres dossiers de documents');

-- Visiteur
reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.document_folders$$,
  '42501', null, 'un visiteur ne peut pas lire les dossiers de documents');

-- Serveur : seulement les écritures prévues

reset role;
set local role service_role;

select throws_ok(
  $$update public.documents set size_bytes = 5$$,
  '42501', null, 'le serveur ne modifie que le nom et le dossier d''un document');
select throws_ok(
  $$delete from public.document_folders$$,
  '42501', null, 'le serveur ne supprime un dossier de documents que par la fonction');

select * from finish();
rollback;
