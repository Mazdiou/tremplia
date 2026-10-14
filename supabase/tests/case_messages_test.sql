begin;
select plan(15);

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


create function pg_temp.student_says(body text, gen integer default 1) returns uuid
language sql as $$
  select public.send_student_message('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), gen, body)
$$;
create function pg_temp.agency_says(body text, actor uuid default '22222222-2222-2222-2222-222222222222')
returns uuid language sql as $$
  select public.send_agency_message('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx), actor, body)
$$;
create function pg_temp.agency_unread() returns bigint language sql as $$
  select coalesce((select unread from public.agency_unread_messages((select agency_a from ctx))
    where case_id = 'cccccccc-cccc-cccc-cccc-cccccccccccc'), 0)
$$;
create function pg_temp.student_unread() returns bigint language sql as $$
  select public.student_unread_messages('cccccccc-cccc-cccc-cccc-cccccccccccc',
    (select agency_a from ctx))
$$;

-- Le candidat n'écrit qu'avec un accès ouvert
select throws_ok($$select pg_temp.student_says('Bonjour')$$, '42501', null,
  'pas de message tant que l''accès est fermé');

select public.enable_student_access('cccccccc-cccc-cccc-cccc-cccccccccccc',
  (select agency_a from ctx), '22222222-2222-2222-2222-222222222222',
  repeat('a', 64), 'chiffre', 1::smallint);

select isnt(pg_temp.student_says('Bonjour, une question sur Lille.'), null,
  'le candidat écrit à l''agence');
select is(pg_temp.agency_unread(), 1::bigint, 'l''agence a un message non lu');
select is(pg_temp.student_unread(), 0::bigint, 'le candidat a lu ce qu''il a écrit');

select lives_ok(
  $$select public.mark_messages_read_agency('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), '11111111-1111-1111-1111-111111111111')$$,
  'le patron ouvre la conversation');
select is(pg_temp.agency_unread(), 0::bigint, 'lu par un membre, lu pour toute l''équipe');

select isnt(pg_temp.agency_says('Bonjour, c''est noté.'), null, 'un employé répond');
select is(pg_temp.student_unread(), 1::bigint, 'le candidat a une réponse non lue');
select lives_ok(
  $$select public.mark_messages_read_student('cccccccc-cccc-cccc-cccc-cccccccccccc',
      (select agency_a from ctx), 1)$$,
  'le candidat ouvre la conversation');
select is(pg_temp.student_unread(), 0::bigint, 'la réponse est lue');

-- Contrôles
select throws_ok($$select pg_temp.agency_says('Intrus', '55555555-5555-5555-5555-555555555555')$$,
  '42501', null, 'un utilisateur désactivé n''écrit pas');
select throws_ok($$select pg_temp.student_says('Ancienne session', 2)$$, '42501', null,
  'une session d''une ancienne génération n''écrit pas');
select throws_ok($$select pg_temp.student_says('   ')$$, '23514', null,
  'un message vide est refusé');

select lives_ok(
  $$select pg_temp.student_says('Message ' || n) from generate_series(1, 29) as n$$,
  'jusqu''à 30 messages par heure');
select throws_ok($$select pg_temp.student_says('Un de trop')$$, '54000', null,
  'au-delà, le candidat doit patienter');

select * from finish();
rollback;
