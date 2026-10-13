begin;
select plan(31);

-- Agence A : patron (1111), employé (2222) ; agence B : patron (3333)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'a2@test.local'),
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

-- Ajout d'un employé : patron seulement ------------------------------------

select lives_ok(
  $$select public.add_employee((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222', 'Employe', 'A')$$,
  'le patron ajoute un employé');

select ok(
  (select must_change_password and role = 'employee' and is_active
     from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  'un nouvel employé est actif et doit changer son mot de passe');

select throws_ok(
  $$select public.add_employee((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222',
      '44444444-4444-4444-4444-444444444444', 'Autre', 'A')$$,
  '42501', null, 'un employé ne peut pas ajouter d''employé');

select throws_ok(
  $$select public.add_employee((select agency_a from ctx),
      '33333333-3333-3333-3333-333333333333',
      '44444444-4444-4444-4444-444444444444', 'Autre', 'A')$$,
  '42501', null, 'le patron d''une autre agence ne peut pas ajouter d''employé ici');

select throws_ok(
  $$select public.create_agency_with_owner(
      '44444444-4444-4444-4444-444444444444', ' Agence', 'Alger', '0555000003', 'P', 'C')$$,
  '23514', null, 'un nom avec des espaces autour est refusé');

-- Désactivation : patron seulement, jamais soi-même ni un patron ----------

select throws_ok(
  $$select public.set_employee_active((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111', false)$$,
  '42501', null, 'un employé ne peut pas désactiver le patron');

select throws_ok(
  $$select public.set_employee_active((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111',
      '11111111-1111-1111-1111-111111111111', false)$$,
  '42501', null, 'le patron ne peut pas se désactiver lui-même');

select throws_ok(
  $$select public.set_employee_active((select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333',
      '22222222-2222-2222-2222-222222222222', false)$$,
  'P0002', null, 'le patron B ne trouve pas l''employé de l''agence A');

select throws_ok(
  $$delete from public.profiles where id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'un employé actif ne peut pas être supprimé');

select is(
  public.set_employee_active((select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222', false),
  true, 'le patron désactive un employé');

select is(
  public.set_employee_active((select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222', false),
  false, 'désactiver deux fois ne change rien');

select throws_ok(
  $$select public.require_active_member('22222222-2222-2222-2222-222222222222',
      (select agency_a from ctx))$$,
  '42501', null, 'un employé désactivé n''est plus un membre actif');

select throws_ok(
  $$delete from public.profiles where id = '11111111-1111-1111-1111-111111111111'$$,
  '42501', null, 'un patron ne peut jamais être supprimé');

select lives_ok(
  $$delete from public.profiles where id = '22222222-2222-2222-2222-222222222222'$$,
  'un employé désactivé, sans historique, peut être supprimé');

-- Serveur (clé secrète) : seulement ce qui lui est accordé -----------------

set local role service_role;

select throws_ok(
  $$insert into public.agencies (name, city, phone) values ('X', 'Y', '0555000009')$$,
  '42501', null, 'le serveur ne crée pas d''agence directement');

select throws_ok(
  $$update public.profiles set role = 'owner'$$,
  '42501', null, 'le serveur ne change pas un rôle directement');

select throws_ok(
  $$update public.profiles set is_active = false$$,
  '42501', null, 'le serveur ne désactive pas un compte sans passer par la fonction');

select lives_ok(
  $$update public.profiles set must_change_password = false
    where id = '11111111-1111-1111-1111-111111111111'$$,
  'le serveur peut lever l''obligation de changer le mot de passe');

reset role;

-- Patron A, connecté --------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.agencies), 1::bigint,
  'le patron A ne voit que sa propre agence');
select is((select count(*) from public.profiles), 1::bigint,
  'le patron A ne voit que les profils de son agence');
select ok(public.is_owner(), 'is_owner reconnaît le patron');

select throws_ok(
  $$update public.agencies set name = 'Piratee'$$,
  '42501', null, 'aucun droit d''écriture direct sur agencies');
select throws_ok(
  $$update public.profiles set is_active = false$$,
  '42501', null, 'aucun droit d''écriture direct sur profiles');
select throws_ok(
  $$select public.create_agency_with_owner(
      gen_random_uuid(), 'Pirate', 'X', '0555000009', 'P', 'P')$$,
  '42501', null, 'create_agency_with_owner ne s''appelle pas depuis le navigateur');

-- Visiteur non connecté -----------------------------------------------------

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.agencies$$,
  '42501', null, 'un visiteur ne lit pas les agences');
select throws_ok(
  $$select count(*) from public.profiles$$,
  '42501', null, 'un visiteur ne lit pas les profils');

-- Inventaire des droits, toutes migrations confondues ---------------------
-- Toute nouvelle table ou fonction doit apparaître ici : un droit accordé
-- par erreur fait échouer ce test.

select is(
  (select array_agg(p.proname::text order by p.proname::text collate "C")
     from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('authenticated', p.oid, 'execute')),
  array['current_agency_id', 'is_owner'],
  'le navigateur n''exécute que current_agency_id et is_owner');

select is(
  (select count(*) from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and has_function_privilege('anon', p.oid, 'execute')),
  0::bigint, 'un visiteur n''exécute aucune fonction');

select is(
  (select count(*)
     from pg_class c
     cross join lateral aclexplode(c.relacl) as a
    where c.relnamespace = 'public'::regnamespace
      and (a.grantee = 'anon'::regrole
           or (a.grantee = 'authenticated'::regrole and a.privilege_type <> 'SELECT')))
  + (select count(*)
       from pg_attribute att
       join pg_class c on c.oid = att.attrelid
       cross join lateral aclexplode(att.attacl) as a
      where c.relnamespace = 'public'::regnamespace
        and a.grantee in ('anon'::regrole, 'authenticated'::regrole)),
  0::bigint, 'le navigateur ne peut que lire ; un visiteur, rien');

select is(
  (select array_agg(c.relname || ':' || a.privilege_type
                    order by (c.relname || ':' || a.privilege_type) collate "C")
     from pg_class c
     cross join lateral aclexplode(c.relacl) as a
    where c.relnamespace = 'public'::regnamespace
      and a.grantee = 'service_role'::regrole
      and a.privilege_type <> 'SELECT'),
  array['activity_log:INSERT', 'document_folders:INSERT', 'documents:DELETE',
        'documents:INSERT'],
  'le serveur n''écrit directement que dans le journal et les documents');

select is(
  (select array_agg(c.relname || '.' || att.attname
                    order by (c.relname || '.' || att.attname) collate "C")
     from pg_attribute att
     join pg_class c on c.oid = att.attrelid
     cross join lateral aclexplode(att.attacl) as a
    where c.relnamespace = 'public'::regnamespace
      and a.grantee = 'service_role'::regrole
      and a.privilege_type = 'UPDATE'),
  array['document_folders.name', 'documents.folder_id', 'documents.name',
        'profiles.must_change_password'],
  'le serveur ne modifie directement que ces colonnes');

select * from finish();
rollback;
