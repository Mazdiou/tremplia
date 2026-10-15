begin;
select plan(20);

-- Patron A, employé A1, employé désactivé A3, patron B
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
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


create function pg_temp.review(decision text, msg text default null, gen integer default 1)
returns boolean language sql as $$
  select public.student_review('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), gen,
    public.student_content_fingerprint('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx)),
    decision, msg)
$$;
create function pg_temp.status() returns text language sql as $$
  select coalesce((select status from public.case_student_reviews
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 'none')
$$;

-- Accès fermé : aucune réponse possible
select throws_ok($$select pg_temp.review('approved')$$, '42501', null,
  'pas de réponse tant que l''accès est fermé');

select public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
  repeat('a', 64), 'chiffre', 1::smallint);

select throws_ok($$select pg_temp.review('approved')$$, '22023', null,
  'rien à valider sans lettre ni formation');

select public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'Madame, Monsieur,');
create temp table p as
select public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '22222222-2222-2222-2222-222222222222', 'Licence Informatique', 'l3', 'Lyon', null) as p1,
       public.create_case_program('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a,
  '22222222-2222-2222-2222-222222222222', 'BUT Informatique', 'but', 'Nantes', null) as p2
from ctx;
grant select on p to public;

-- Validation
select is(pg_temp.review('approved'), true, 'le candidat valide');
select is(pg_temp.status(), 'approved', 'le dossier est validé');
select is(pg_temp.review('approved'), false, 'une deuxième validation ne change rien');

select throws_ok($$select pg_temp.review('approved', null, 2)$$, '42501', null,
  'une session d''une ancienne génération est refusée');
select throws_ok($$select pg_temp.review('maybe')$$, '22023', null,
  'une réponse inconnue est refusée');
select throws_ok(
  $$select public.student_review('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), 1, 'empreinte-d-une-ancienne-version', 'approved', null)$$,
  '55000', null, 'une réponse sur une version déjà modifiée est refusée');

-- Toute modification de l'agence remet « en attente »
select public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'Madame, Monsieur, (v2)');
select is(pg_temp.status(), 'pending', 'une lettre modifiée doit être revalidée');

select pg_temp.review('approved');
select public.move_case_program((select p2 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', -1);
select is(pg_temp.status(), 'pending', 'un nouvel ordre des formations doit être revalidé');

select pg_temp.review('approved');
select public.save_motivation_letter('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'Madame, Monsieur, (v2)');
select is(pg_temp.status(), 'approved', 'un enregistrement identique ne change rien');

-- La réponse d'un établissement ne fait pas partie de ce que le candidat valide
create temp table fp as
select public.student_content_fingerprint('cccccccc-cccc-cccc-cccc-cccccccccccc', agency_a) as before
from ctx;
select public.set_case_program_result((select p1 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '22222222-2222-2222-2222-222222222222', 'accepted');
select is(pg_temp.status(), 'approved', 'noter une réponse ne redemande pas l''avis du candidat');
select is(
  public.student_content_fingerprint('cccccccc-cccc-cccc-cccc-cccccccccccc', (select agency_a from ctx)),
  (select before from fp), 'la réponse ne change pas l''empreinte du contenu');

-- Demande de modification
select is(pg_temp.review('changes_requested', 'Pouvez-vous ajouter Lille ?'), true,
  'le candidat demande une modification');
select is(pg_temp.status(), 'changes_requested', 'la demande est enregistrée');
select is(
  (select sender || ':' || kind || ':' || body from public.case_messages
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'),
  'student:change_request:Pouvez-vous ajouter Lille ?',
  'son message rejoint la conversation du dossier');
select throws_ok($$select pg_temp.review('changes_requested', '  ')$$, '23514', null,
  'une demande sans message est refusée');

select public.delete_case_program((select p1 from p), 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '22222222-2222-2222-2222-222222222222');
select is(pg_temp.status(), 'pending', 'la correction de l''agence redemande l''avis du candidat');

-- Lecture (RLS)
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.case_messages), 1::bigint,
  'l''agence lit la conversation');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.case_student_reviews), 0::bigint,
  'une autre agence ne voit pas la réponse');

select * from finish();
rollback;
