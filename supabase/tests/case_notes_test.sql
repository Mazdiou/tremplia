begin;
select plan(42);

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

select public.create_case('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '11111111-1111-1111-1111-111111111111',
  public.create_campaign(agency_a, '11111111-1111-1111-1111-111111111111',
    'Campagne A', null, '{}', '[]', '[]', '{}'),
  null,
  '{"first_name": "Karim", "last_name": "A-case", "birth_date": "2004-05-01",
    "phone": "0555111111", "education_level": "l3"}',
  null, null, null)
from ctx;

-- Ajouter une note
create temp table n1 as
select public.create_case_note(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx),
  '22222222-2222-2222-2222-222222222222',
  'Premier appel : documents à relancer.') as id;

select ok((select id from n1) is not null, 'un employé actif ajoute une note');

select is(
  (select author_id from public.case_notes where id = (select id from n1)),
  '22222222-2222-2222-2222-222222222222'::uuid,
  'l''auteur de la note est celui qui l''a écrite');

select ok(
  (select edited_at is null and edited_by is null
     from public.case_notes where id = (select id from n1)),
  'une note neuve n''est pas marquée comme modifiée');

select throws_ok(
  $$select public.create_case_note('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', '   ')$$,
  '23514', null, 'une note vide est refusée');

select throws_ok(
  $$select public.create_case_note('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', repeat('x', 5001))$$,
  '23514', null, 'une note de plus de 5000 caractères est refusée');

select lives_ok(
  $$select public.create_case_note('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', repeat('x', 5000))$$,
  'une note de 5000 caractères est acceptée');

select throws_ok(
  $$select public.create_case_note('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '33333333-3333-3333-3333-333333333333', 'Intrus')$$,
  '42501', null, 'un utilisateur d''une autre agence ne peut pas écrire');

select throws_ok(
  $$select public.create_case_note('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '55555555-5555-5555-5555-555555555555', 'Compte désactivé')$$,
  '42501', null, 'un utilisateur désactivé ne peut pas écrire');

select throws_ok(
  $$select public.create_case_note(gen_random_uuid(),
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'Dossier inconnu')$$,
  'P0002', null, 'un dossier inconnu est refusé');

-- Modifier une note
select throws_ok(
  $$select public.update_case_note((select id from n1), (select agency_a from ctx),
      '44444444-4444-4444-4444-444444444444', 'Réécrite par un collègue')$$,
  '42501', null, 'un employé ne modifie pas la note d''un collègue');

select throws_ok(
  $$select public.update_case_note((select id from n1), (select agency_a from ctx),
      '55555555-5555-5555-5555-555555555555', 'Réécrite par un compte désactivé')$$,
  '42501', null, 'un utilisateur désactivé ne modifie rien');

select throws_ok(
  $$select public.update_case_note((select id from n1), (select agency_a from ctx),
      '33333333-3333-3333-3333-333333333333', 'Réécrite par une autre agence')$$,
  '42501', null, 'le patron d''une autre agence ne modifie pas la note');

select is(
  (select content from public.case_notes where id = (select id from n1)),
  'Premier appel : documents à relancer.',
  'les tentatives refusées n''ont rien changé');

select lives_ok(
  $$select public.update_case_note((select id from n1), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Premier appel : dossier relancé.')$$,
  'l''auteur modifie sa note');

select ok(
  (select edited_at is not null and edited_by = '22222222-2222-2222-2222-222222222222'
     from public.case_notes where id = (select id from n1)),
  'la modification est enregistrée avec son auteur');

select throws_ok(
  $$select public.update_case_note((select id from n1), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', '  ')$$,
  '23514', null, 'une modification vide est refusée');

select lives_ok(
  $$select public.update_case_note((select id from n1), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Corrigé par le patron.')$$,
  'le patron modifie la note d''un employé');

select is(
  (select edited_by from public.case_notes where id = (select id from n1)),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'la note indique que le patron l''a modifiée');

select throws_ok(
  $$select public.update_case_note(gen_random_uuid(), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Note inconnue')$$,
  'P0002', null, 'modifier une note inconnue est refusé');

-- Supprimer une note
select throws_ok(
  $$select public.delete_case_note((select id from n1), (select agency_a from ctx),
      '44444444-4444-4444-4444-444444444444')$$,
  '42501', null, 'un employé ne supprime pas la note d''un collègue');

select throws_ok(
  $$select public.delete_case_note((select id from n1), (select agency_a from ctx),
      '33333333-3333-3333-3333-333333333333')$$,
  '42501', null, 'le patron d''une autre agence ne supprime pas la note');

select throws_ok(
  $$select public.delete_case_note((select id from n1), (select agency_a from ctx),
      '55555555-5555-5555-5555-555555555555')$$,
  '42501', null, 'un utilisateur désactivé ne supprime rien');

select ok(
  exists (select 1 from public.case_notes where id = (select id from n1)),
  'la note existe toujours après les suppressions refusées');

create temp table n2 as
select public.create_case_note(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx),
  '44444444-4444-4444-4444-444444444444',
  'Note de l''employé 2.') as id;

select lives_ok(
  $$select public.delete_case_note((select id from n2), (select agency_a from ctx),
      '44444444-4444-4444-4444-444444444444')$$,
  'l''auteur supprime sa propre note');

select ok(
  not exists (select 1 from public.case_notes where id = (select id from n2)),
  'la note supprimée a disparu');

select lives_ok(
  $$select public.delete_case_note((select id from n1), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  'le patron supprime la note d''un employé');

select throws_ok(
  $$select public.delete_case_note(gen_random_uuid(), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  'P0002', null, 'supprimer une note inconnue est refusé');

-- Contraintes directes (droits d'administrateur)
select throws_ok(
  $$insert into public.case_notes (agency_id, case_id, author_id, content)
    select agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      '33333333-3333-3333-3333-333333333333', 'Auteur d''une autre agence' from ctx$$,
  '23503', null, 'l''auteur doit être de la même agence que la note');

select throws_ok(
  $$insert into public.case_notes (agency_id, case_id, author_id, content)
    select agency_b, 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      '33333333-3333-3333-3333-333333333333', 'Dossier d''une autre agence' from ctx$$,
  '23503', null, 'une note ne peut pas viser le dossier d''une autre agence');

select throws_ok(
  $$insert into public.case_notes (agency_id, case_id, author_id, content, edited_at)
    select agency_a, 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      '11111111-1111-1111-1111-111111111111', 'Modifiée sans auteur', now() from ctx$$,
  '23514', null, 'une date de modification exige son auteur');

create temp table n3 as
select public.create_case_note(
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx),
  '22222222-2222-2222-2222-222222222222',
  'Note pour les tests de droits.') as id;

select throws_ok(
  $$update public.case_notes set author_id = '44444444-4444-4444-4444-444444444444'
    where id = (select id from n3)$$,
  '42501', null, 'l''auteur d''une note ne change pas');

-- Patron A
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

-- Il reste 2 notes : celle de 5000 caractères et la note n3
select is((select count(*) from public.case_notes), 2::bigint,
  'le patron voit les notes de son agence');

select throws_ok(
  $$insert into public.case_notes (agency_id, case_id, author_id, content)
    select agency_id, 'cccccccc-cccc-cccc-cccc-cccccccccccc', id, 'Direct'
    from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'un patron n''écrit pas une note directement');

select throws_ok(
  $$update public.case_notes set content = 'Direct'$$,
  '42501', null, 'un patron ne modifie pas une note directement');

select throws_ok(
  $$delete from public.case_notes$$,
  '42501', null, 'un patron ne supprime pas une note directement');

select throws_ok(
  $$select public.create_case_note(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'x')$$,
  '42501', null, 'l''ajout de note ne s''appelle pas depuis le navigateur');

select throws_ok(
  $$select public.update_case_note(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'x')$$,
  '42501', null, 'la modification de note ne s''appelle pas depuis le navigateur');

select throws_ok(
  $$select public.delete_case_note(gen_random_uuid(), gen_random_uuid(), gen_random_uuid())$$,
  '42501', null, 'la suppression de note ne s''appelle pas depuis le navigateur');

-- Employé A2
reset role;
select set_config('request.jwt.claims',
  '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.case_notes), 2::bigint,
  'un employé voit les notes de ses collègues');

select throws_ok(
  $$delete from public.case_notes$$,
  '42501', null, 'un employé ne supprime pas une note directement');

-- Patron B
reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.case_notes), 0::bigint,
  'une autre agence ne voit aucune note');

-- Visiteur
reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.case_notes$$,
  '42501', null, 'un visiteur ne peut pas lire les notes');

select * from finish();
rollback;
