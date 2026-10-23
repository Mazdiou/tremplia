begin;
select plan(14);

-- A : non confirmé depuis 8 jours, agence vide → supprimé
-- B : non confirmé depuis 2 jours → gardé (encore dans le délai)
-- C : confirmé depuis 8 jours → gardé
-- D : non confirmé depuis 8 jours mais son agence a une campagne → gardé
-- E : non confirmé depuis 8 jours, administrateur → gardé
-- F : non confirmé depuis 8 jours, sans profil (inscription interrompue) → supprimé
-- G : non confirmé depuis 8 jours, agence avec un employé → gardé
insert into auth.users (id, email, email_confirmed_at, created_at) values
  ('a0000000-0000-0000-0000-000000000000', 'pa@test.local', null, now() - interval '8 days'),
  ('b0000000-0000-0000-0000-000000000000', 'pb@test.local', null, now() - interval '2 days'),
  ('c0000000-0000-0000-0000-000000000000', 'pc@test.local', now(), now() - interval '8 days'),
  ('d0000000-0000-0000-0000-000000000000', 'pd@test.local', null, now() - interval '8 days'),
  ('e0000000-0000-0000-0000-000000000000', 'pe@test.local', null, now() - interval '8 days'),
  ('f0000000-0000-0000-0000-000000000000', 'pf@test.local', null, now() - interval '8 days'),
  ('10000000-0000-0000-0000-000000000000', 'pg@test.local', null, now() - interval '8 days'),
  ('11000000-0000-0000-0000-000000000000', 'pg-emp@test.local', now(), now() - interval '8 days');

select public.create_agency_with_owner(id, 'Agence ' || email, 'Alger', '0555000001', 'Patron', 'X')
from auth.users
where id in ('a0000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000000',
             'c0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
             'e0000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000000');

insert into public.profiles (id, agency_id, first_name, last_name, role)
select '11000000-0000-0000-0000-000000000000', agency_id, 'Employe', 'G', 'employee'
from public.profiles where id = '10000000-0000-0000-0000-000000000000';

insert into public.platform_admins (user_id) values ('e0000000-0000-0000-0000-000000000000');

create temp table ctx as
select (select agency_id from public.profiles where id = 'a0000000-0000-0000-0000-000000000000') as agency_a,
       (select agency_id from public.profiles where id = 'd0000000-0000-0000-0000-000000000000') as agency_d;

select public.create_campaign(agency_d, 'd0000000-0000-0000-0000-000000000000',
  'Campagne D', null, '{}', '[]', '[]', '{}') from ctx;

-- Toutes les agences ont dépassé leur essai : en lecture seule
update public.agencies set subscription_ends_at = now() - interval '1 day'
where id in (select agency_id from public.profiles where id in (
  'a0000000-0000-0000-0000-000000000000', 'd0000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000000'));

-- Les règles habituelles tiennent toujours hors de la purge
select throws_ok(
  $$delete from public.profiles where id = 'c0000000-0000-0000-0000-000000000000'$$,
  '42501', null, 'hors purge, un patron ne se supprime toujours pas');
select throws_ok(
  $$delete from public.campaigns where agency_id = (select agency_d from ctx)$$,
  '25006', null, 'hors purge, une agence expirée reste en lecture seule');

select throws_ok($$select public.purge_unconfirmed_registrations(interval '1 hour')$$,
  '22023', null, 'délai de moins d''un jour refusé');

create temp table purged as
select public.purge_unconfirmed_registrations() as n;
-- Seuls A et F (d'autres comptes de la base locale peuvent s'y ajouter)
select ok((select n from purged) >= 2, 'au moins les deux comptes visés supprimés');

select is((select count(*) from auth.users where id = 'a0000000-0000-0000-0000-000000000000'), 0::bigint,
  'A : compte supprimé');
select is((select count(*) from public.agencies where id = (select agency_a from ctx)), 0::bigint,
  'A : agence supprimée');
select is((select count(*) from public.activity_log where agency_id = (select agency_a from ctx)), 0::bigint,
  'A : journal de l''agence supprimé');
select is((select count(*) from auth.users where id = 'f0000000-0000-0000-0000-000000000000'), 0::bigint,
  'F : compte sans profil supprimé');
select is((select count(*) from auth.users where id = 'b0000000-0000-0000-0000-000000000000'), 1::bigint,
  'B : encore dans le délai, gardé');
select is((select count(*) from auth.users where id = 'c0000000-0000-0000-0000-000000000000'), 1::bigint,
  'C : adresse confirmée, gardé');
select is((select count(*) from auth.users where id = 'd0000000-0000-0000-0000-000000000000'), 1::bigint,
  'D : agence avec une campagne, gardé');
select is((select count(*) from auth.users where id = 'e0000000-0000-0000-0000-000000000000'), 1::bigint,
  'E : administrateur, gardé');
select is((select count(*) from auth.users where id = '10000000-0000-0000-0000-000000000000'), 1::bigint,
  'G : agence avec un employé, gardé');

select is(current_setting('tremplia.purge', true), 'off', 'réglage de purge retiré après la purge');

select * from finish();
rollback;
