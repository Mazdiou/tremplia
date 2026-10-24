begin;
select plan(28);

-- Empreintes factices (64 caractères hexadécimaux)
create function pg_temp.h(n text) returns text language sql as $$ select md5(n) || md5(n) $$;

-- Les demandes déjà enregistrées ne doivent pas fausser les comptes (tout
-- est annulé à la fin du test)
delete from public.email_requests;

-- 1. Demandes d'e-mail

select is(public.email_request_allowed('recovery', pg_temp.h('ip-1'), pg_temp.h('mail-1')), true,
  'première demande acceptée');
select is(public.email_request_allowed('recovery', pg_temp.h('ip-2'), pg_temp.h('mail-1')), true,
  'deuxième demande pour la même adresse');
select is(public.email_request_allowed('recovery', pg_temp.h('ip-3'), pg_temp.h('mail-1')), true,
  'troisième demande pour la même adresse');
select is(public.email_request_allowed('recovery', pg_temp.h('ip-4'), pg_temp.h('mail-1')), false,
  'la quatrième en une heure pour la même adresse n''envoie rien, sans erreur');
select is(public.email_request_allowed('confirmation', pg_temp.h('ip-5'), pg_temp.h('mail-1')), true,
  'l''autre sorte d''e-mail a son propre compte');

-- Par adresse IP : 5 demandes par heure
delete from public.email_requests;
select public.email_request_allowed('recovery', pg_temp.h('meme-ip'), pg_temp.h('mail-' || n))
from generate_series(1, 5) as n;
select throws_ok(
  $$select public.email_request_allowed('recovery', pg_temp.h('meme-ip'), pg_temp.h('mail-6'))$$,
  '54000', null, 'la sixième demande en une heure depuis une même adresse IP est refusée');
select lives_ok(
  $$select public.email_request_allowed('recovery', pg_temp.h('autre-ip'), pg_temp.h('mail-6'))$$,
  'une autre adresse IP peut demander');

update public.email_requests set requested_at = now() - interval '61 minutes';
select lives_ok(
  $$select public.email_request_allowed('recovery', pg_temp.h('meme-ip'), pg_temp.h('mail-6'))$$,
  'une heure plus tard, la première adresse IP peut redemander');

-- Pour tout le service : 50 demandes par heure
delete from public.email_requests;
insert into public.email_requests (kind, ip_hash, email_hash)
select 'recovery', pg_temp.h('ip-' || n), pg_temp.h('mail-' || n) from generate_series(1, 50) as n;
select throws_ok(
  $$select public.email_request_allowed('recovery', pg_temp.h('nouvelle-ip'), pg_temp.h('nouveau-mail'))$$,
  '54000', null, 'au-delà de 50 demandes en une heure, tout le service est bloqué');

select throws_ok(
  $$insert into public.email_requests (kind, ip_hash, email_hash) values ('autre', 'x', 'y')$$,
  '23514', null, 'sorte d''e-mail et empreintes contrôlées');

-- 2. Compte lié à une adresse

-- Patron A (adresse confirmée), employé actif, employé désactivé, compte
-- suspendu, compte non confirmé
insert into auth.users (id, email, email_confirmed_at, banned_until) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local', now(), null),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local', now(), null),
  ('33333333-3333-3333-3333-333333333333', 'a2@test.local', now(), null),
  ('44444444-4444-4444-4444-444444444444', 'a3@test.local', now(), now() + interval '100 years'),
  ('55555555-5555-5555-5555-555555555555', 'b0@test.local', null, null);

select public.create_agency_with_owner(
  '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001', 'Patron', 'A');
select public.create_agency_with_owner(
  '55555555-5555-5555-5555-555555555555', 'Agence B', 'Oran', '0555000002', 'Patron', 'B');

insert into public.profiles (id, agency_id, first_name, last_name, role, is_active)
select v.id, p.agency_id, v.fn, 'A', 'employee', v.active
from public.profiles p,
  (values
    ('22222222-2222-2222-2222-222222222222'::uuid, 'Actif', true),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'Desactive', false),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'Suspendu', true)
  ) as v(id, fn, active)
where p.id = '11111111-1111-1111-1111-111111111111';

select results_eq(
  $$select user_id, first_name, confirmed, active from public.account_for_email('  A0@Test.Local ')$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid, 'Patron'::text, true, true)$$,
  'adresse retrouvée sans tenir compte des majuscules ni des espaces');
select is((select active from public.account_for_email('a1@test.local')), true, 'employé actif');
select is((select active from public.account_for_email('a2@test.local')), false, 'employé désactivé');
select is((select active from public.account_for_email('a3@test.local')), false, 'compte suspendu');
select is((select confirmed from public.account_for_email('b0@test.local')), false,
  'adresse pas encore confirmée');
select is_empty($$select * from public.account_for_email('inconnu@test.local')$$,
  'adresse inconnue : aucune ligne');

-- 3. Rappels

create temp table ctx as
select
  (select agency_id from public.profiles
    where id = '11111111-1111-1111-1111-111111111111') as agency_a,
  (select agency_id from public.profiles
    where id = '55555555-5555-5555-5555-555555555555') as agency_b;

create function pg_temp.due(a uuid) returns setof text language sql as $$
  select kind || ':' || email from public.due_subscription_reminders() where agency_id = a $$;

-- Agence A inscrite il y a 10 jours, essai jusqu'à dans 5 jours
update public.agencies
set created_at = now() - interval '10 days', subscription_ends_at = now() + interval '5 days'
where id = (select agency_a from ctx);

select results_eq($$select * from pg_temp.due((select agency_a from ctx))$$,
  $$values ('j7:a0@test.local')$$,
  'rappel à 7 jours, au patron seulement');

-- Réservé une fois, pas deux
select is(public.claim_subscription_reminder(agency_a,
  (select subscription_ends_at from public.agencies where id = agency_a), 'j7'), true,
  'rappel réservé') from ctx;
select is(public.claim_subscription_reminder(agency_a,
  (select subscription_ends_at from public.agencies where id = agency_a), 'j7'), false,
  'déjà réservé : refusé') from ctx;
select is_empty($$select * from pg_temp.due((select agency_a from ctx))$$,
  'rappel à 7 jours déjà parti : plus rien à envoyer');

-- Envoi échoué : libéré, il revient
select public.release_subscription_reminder(agency_a,
  (select subscription_ends_at from public.agencies where id = agency_a), 'j7') from ctx;
select results_eq($$select * from pg_temp.due((select agency_a from ctx))$$,
  $$values ('j7:a0@test.local')$$, 'rappel libéré : de nouveau à envoyer');

-- La veille : rappel à 1 jour, même si celui à 7 jours est parti
select public.claim_subscription_reminder(agency_a,
  (select subscription_ends_at from public.agencies where id = agency_a), 'j7') from ctx;
update public.subscription_reminders set ends_at = now() + interval '20 hours'
where agency_id = (select agency_a from ctx);
update public.agencies set subscription_ends_at = (
  select ends_at from public.subscription_reminders where agency_id = agency_a limit 1)
from ctx where id = agency_a;
select results_eq($$select * from pg_temp.due((select agency_a from ctx))$$,
  $$values ('j1:a0@test.local')$$, 'rappel la veille');

-- Renouvelé : nouvelle échéance, les rappels repartent de zéro
update public.agencies set subscription_ends_at = now() + interval '6 days'
where id = (select agency_a from ctx);
select results_eq($$select * from pg_temp.due((select agency_a from ctx))$$,
  $$values ('j7:a0@test.local')$$, 'nouvelle échéance : nouveau rappel');

-- Échéance lointaine ou passée : rien
update public.agencies set subscription_ends_at = now() + interval '8 days'
where id = (select agency_a from ctx);
select is_empty($$select * from pg_temp.due((select agency_a from ctx))$$,
  'échéance à plus de 7 jours : rien');
update public.agencies set subscription_ends_at = now() - interval '1 hour'
where id = (select agency_a from ctx);
select is_empty($$select * from pg_temp.due((select agency_a from ctx))$$,
  'agence déjà expirée : rien');

-- Essai qui vient de commencer : pas de rappel à 7 jours
update public.agencies set subscription_ends_at = now() + interval '6 days 23 hours'
where id = (select agency_b from ctx);
update auth.users set email_confirmed_at = now()
where id = '55555555-5555-5555-5555-555555555555';
select is_empty($$select * from pg_temp.due((select agency_b from ctx))$$,
  'inscrite depuis moins de 2 jours : pas de rappel à 7 jours');

-- Adresse du patron pas confirmée : rien
update public.agencies set created_at = now() - interval '3 days'
where id = (select agency_b from ctx);
update auth.users set email_confirmed_at = null
where id = '55555555-5555-5555-5555-555555555555';
select is_empty($$select * from pg_temp.due((select agency_b from ctx))$$,
  'adresse du patron non confirmée : rien');

-- Agence de l'administrateur : jamais de rappel
update auth.users set email_confirmed_at = now()
where id = '55555555-5555-5555-5555-555555555555';
insert into public.platform_admins (user_id) values ('55555555-5555-5555-5555-555555555555');
select is_empty($$select * from pg_temp.due((select agency_b from ctx))$$,
  'agence de l''administrateur : pas de rappel');

select * from finish();
rollback;
