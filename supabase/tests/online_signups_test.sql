begin;
select plan(75);

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

-- Campagnes : A1 et A2 actives, A3 archivée ; B1 à l'agence B
create function pg_temp.campaign(agency uuid, owner uuid, n text) returns uuid
language sql as $$
  select public.create_campaign(agency, owner, n, null, '{}', '[]', '[]', '{}') $$;
create temp table camps as
select
  pg_temp.campaign(agency_a, '11111111-1111-1111-1111-111111111111', 'France 2027') as a1,
  pg_temp.campaign(agency_a, '11111111-1111-1111-1111-111111111111', 'Canada 2027') as a2,
  pg_temp.campaign(agency_a, '11111111-1111-1111-1111-111111111111', 'Ancienne') as a3,
  pg_temp.campaign(agency_b, '33333333-3333-3333-3333-333333333333', 'Campagne B') as b1
from ctx;
grant select on camps to public;
select public.set_campaign_status(a3, agency_a, '11111111-1111-1111-1111-111111111111', 'archived')
from camps, ctx;

create function pg_temp.settings(enabled boolean, slug text, ids uuid[],
  actor uuid default '11111111-1111-1111-1111-111111111111') returns void
language sql as $$
  select public.save_signup_settings((select agency_a from ctx), actor, enabled, slug, ids) $$;

-- Demande envoyée sur la page de l'agence A (adresse « agence-a »)
create function pg_temp.fields(first text, last text, birth text default '2005-03-10')
returns jsonb language sql as $$
  select jsonb_build_object('first_name', first, 'last_name', last, 'birth_date', birth,
    'phone', '0555123456', 'education_level', 'terminale') $$;
create function pg_temp.submit(f jsonb, campaign uuid default null,
  slug text default 'agence-a', message text default null) returns uuid
language sql as $$
  select signup_id from public.submit_online_signup(slug,
    coalesce(campaign, (select a1 from camps)), f, message) $$;
create function pg_temp.signup(last text) returns uuid language sql as $$
  select id from public.online_signups where fields ->> 'last_name' = last $$;

-- 1. Réglages (patron)

select throws_ok($$select pg_temp.settings(true, 'agence-a', '{}',
    '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'un employé ne règle pas l''inscription en ligne');
select throws_ok($$select pg_temp.settings(true, null, '{}')$$,
  '23514', null, 'une page activée a une adresse');
select throws_ok($$select pg_temp.settings(false, 'Agence A', '{}')$$,
  '23514', null, 'adresse : minuscules, chiffres et tirets seulement');
select throws_ok($$select pg_temp.settings(false, 'ab', '{}')$$,
  '23514', null, 'adresse : 3 caractères au moins');
select throws_ok($$select pg_temp.settings(false, '-agence', '{}')$$,
  '23514', null, 'adresse : pas de tiret au début');
select throws_ok($$select pg_temp.settings(true, 'agence-a', array[(select a3 from camps)])$$,
  '22023', null, 'une campagne archivée n''est pas proposée');
select throws_ok($$select pg_temp.settings(true, 'agence-a', array[(select b1 from camps)])$$,
  '22023', null, 'une campagne d''une autre agence est refusée');

select public.save_signup_settings(agency_b, '33333333-3333-3333-3333-333333333333',
  true, 'agence-b', array[b1]) from ctx, camps;
select throws_ok($$select pg_temp.settings(true, 'agence-b', '{}')$$,
  '23505', null, 'une adresse déjà prise est refusée');

select lives_ok($$select pg_temp.settings(true, 'agence-a',
    array[(select a1 from camps), (select a2 from camps)])$$,
  'le patron active la page avec deux campagnes');
select results_eq(
  $$select signup_enabled, signup_slug from public.agencies where id = (select agency_a from ctx)$$,
  $$values (true, 'agence-a')$$, 'page activée, adresse enregistrée');
select pg_temp.settings(true, 'agence-a', array[(select a1 from camps)]);
select results_eq(
  $$select name, signup_open from public.campaigns
    where agency_id = (select agency_a from ctx) and status = 'active' order by name$$,
  $$values ('Canada 2027'::text, false), ('France 2027', true)$$,
  'une campagne retirée n''est plus proposée');

-- 2. Page publique

select results_eq(
  $$select agency_name, agency_city, is_open, campaigns from public.online_signup_page('agence-a')$$,
  $$select 'Agence A'::text, 'Alger'::text, true,
      jsonb_build_array(jsonb_build_object('id', a1, 'name', 'France 2027')) from camps$$,
  'la page montre l''agence et ses campagnes ouvertes');
select is((select count(*) from public.online_signup_page('inconnue')), 0::bigint,
  'adresse inconnue : rien');

select pg_temp.settings(true, 'agence-a', '{}');
select is((select is_open from public.online_signup_page('agence-a')), false,
  'sans campagne ouverte, la page est fermée');
select pg_temp.settings(false, 'agence-a', array[(select a1 from camps)]);
select is((select is_open from public.online_signup_page('agence-a')), false,
  'page désactivée : fermée');
select pg_temp.settings(true, 'agence-a', array[(select a1 from camps)]);

-- 3. Limites d'essais

select lives_ok($$select public.online_signup_attempt('agence-a', repeat('a', 64))
    from generate_series(1, 5)$$,
  '5 essais par heure et par adresse');
select throws_ok($$select public.online_signup_attempt('agence-a', repeat('a', 64))$$,
  '54000', null, 'le 6e essai de la même adresse est refusé');
select throws_ok($$select public.online_signup_attempt('inconnue', repeat('a', 64))$$,
  '54000', null, 'même sur une adresse de page inconnue');
select lives_ok($$select public.online_signup_attempt('agence-a', repeat('b', 64))$$,
  'une autre adresse IP peut envoyer');
select is((select count(*) from public.online_signup_attempts where agency_id is null), 0::bigint,
  'un essai refusé n''est pas enregistré');

select public.online_signup_attempt('agence-a', lpad(to_hex(n), 64, 'c'))
from generate_series(1, 54) n;
select throws_ok($$select public.online_signup_attempt('agence-a', repeat('d', 64))$$,
  '54000', null, '60 essais par heure au plus pour une agence');
select lives_ok($$select public.online_signup_attempt('agence-b', repeat('d', 64))$$,
  'les autres agences ne sont pas touchées');
select throws_ok($$select public.online_signup_attempt('agence-b', 'pas-une-empreinte')$$,
  '23514', null, 'seule une empreinte est enregistrée');

update public.online_signup_attempts set attempted_at = now() - interval '2 days';
select public.online_signup_attempt('agence-b', repeat('e', 64));
select is((select count(*) from public.online_signup_attempts), 1::bigint,
  'les essais de plus d''un jour sont oubliés');

-- 4. Envoi du candidat

select isnt(pg_temp.submit(pg_temp.fields('Amine', 'Kaci'), null, 'agence-a', 'Bonjour'),
  null, 'une demande est enregistrée');
select results_eq(
  $$select agency_id, campaign_id, message, search_name from public.online_signups
    where id = pg_temp.signup('Kaci')$$,
  $$select agency_a, a1, 'Bonjour'::text, 'kaci amine'::text from ctx, camps$$,
  'agence, campagne, message et nom comparable');
select results_eq(
  $$select agency_id from public.submit_online_signup('agence-a', (select a1 from camps),
      pg_temp.fields('Lina', 'Haddad'), null)$$,
  $$select agency_a from ctx$$, 'l''envoi renvoie l''agence (notification)');

select throws_ok($$select pg_temp.submit(pg_temp.fields('Amine', 'KACI'))$$,
  '23505', null, 'une même personne n''a qu''une demande en attente');
select throws_ok($$select pg_temp.submit(pg_temp.fields('Âmine', 'Kaci'))$$,
  '23505', null, 'doublon détecté malgré les accents');
select isnt(pg_temp.submit(pg_temp.fields('Amine', 'Kaci', '2006-01-01')),
  null, 'même nom, autre date de naissance : autre personne');

select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y'), null, 'inconnue')$$,
  'P0002', null, 'adresse inconnue : refusée');
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y'), (select a2 from camps))$$,
  '22023', null, 'campagne non proposée : refusée');
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y'), (select b1 from camps))$$,
  '22023', null, 'campagne d''une autre agence : refusée');
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y') - 'phone')$$,
  '22023', null, 'un champ obligatoire manque : refusé');
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y') || '{"status": "closed"}')$$,
  '22023', null, 'un champ inconnu est refusé');
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y') || '{"phone": "  "}')$$,
  '22023', null, 'un champ obligatoire vide est refusé');
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y'), null, 'agence-a', '   ')$$,
  '23514', null, 'un message vide est refusé');
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y'), null, 'agence-a', repeat('m', 1001))$$,
  '23514', null, 'un message de plus de 1000 caractères est refusé');

select pg_temp.settings(false, 'agence-a', array[(select a1 from camps)]);
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y'))$$,
  'P0002', null, 'page désactivée : refusée');
select pg_temp.settings(true, 'agence-a', array[(select a1 from camps)]);

-- 500 demandes en attente au plus par agence
insert into public.online_signups (agency_id, campaign_id, fields)
select agency_a, a1, pg_temp.fields('Prenom', 'Nom' || n)
from ctx, camps, generate_series(1, 497) n;
select throws_ok($$select pg_temp.submit(pg_temp.fields('Encore', 'Une'))$$,
  '54000', null, '500 demandes en attente au plus');
delete from public.online_signups where fields ->> 'last_name' like 'Nom%';

-- 5. Lecture par le navigateur

select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.online_signups), 3::bigint,
  'un membre voit les demandes de son agence');
select throws_ok(
  $$insert into public.online_signups (agency_id, fields)
    select agency_a, pg_temp.fields('X', 'Y') from ctx$$,
  '42501', null, 'le navigateur ne crée pas de demande');
select throws_ok($$delete from public.online_signups$$,
  '42501', null, 'le navigateur ne supprime pas de demande');
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y'))$$,
  '42501', null, 'le navigateur n''appelle pas l''envoi');
select throws_ok($$select * from public.online_signup_page('agence-a')$$,
  '42501', null, 'le navigateur ne lit pas la page publique par la base');
select throws_ok($$select count(*) from public.online_signup_attempts$$,
  '42501', null, 'les essais ne sont pas lisibles');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*) from public.online_signups), 0::bigint,
  'une autre agence ne voit pas ces demandes');
reset role;

select ok(not has_function_privilege('anon', 'public.submit_online_signup(text, uuid, jsonb, text)', 'execute'),
  'un visiteur n''appelle pas la base directement');

-- 6. Refus

select throws_ok(
  $$select public.delete_online_signup(pg_temp.signup('Haddad'), (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333')$$,
  'P0002', null, 'une autre agence ne refuse pas la demande');
select throws_ok(
  $$select public.delete_online_signup(pg_temp.signup('Haddad'), (select agency_a from ctx),
      '55555555-5555-5555-5555-555555555555')$$,
  '42501', null, 'un employé désactivé ne refuse rien');
select lives_ok(
  $$select public.delete_online_signup(pg_temp.signup('Haddad'), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  'un employé refuse une demande');
select is(pg_temp.signup('Haddad'), null, 'la demande refusée est supprimée');
select throws_ok(
  $$select public.delete_online_signup('99999999-9999-9999-9999-999999999999',
      (select agency_a from ctx), '22222222-2222-2222-2222-222222222222')$$,
  'P0002', null, 'demande introuvable');

-- 7. Acceptation : création du dossier

create function pg_temp.accept(signup uuid, assigned uuid default '22222222-2222-2222-2222-222222222222')
returns uuid language sql as $$
  select public.create_case(gen_random_uuid(), (select agency_a from ctx),
    '22222222-2222-2222-2222-222222222222', (select a1 from camps), assigned,
    (select fields from public.online_signups where id = signup), null, null, null,
    null, null, signup) $$;

create temp table kept as select id from public.online_signups
where fields ->> 'last_name' = 'Kaci' and fields ->> 'birth_date' = '2005-03-10';
grant select on kept to public;

select throws_ok($$select pg_temp.accept((select id from kept), '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'un employé ne crée pas un dossier pour un autre');
select throws_ok(
  $$select public.create_case(gen_random_uuid(), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', (select a3 from camps),
      '22222222-2222-2222-2222-222222222222', pg_temp.fields('Amine', 'Kaci'),
      null, null, null, null, null, (select id from kept))$$,
  '55000', null, 'campagne archivée : le dossier n''est pas créé');
select is((select count(*) from public.online_signups where id = (select id from kept)), 1::bigint,
  'un dossier non créé laisse la demande en place');

select isnt(pg_temp.accept((select id from kept)), null, 'le dossier est créé depuis la demande');
select is((select count(*) from public.online_signups where id = (select id from kept)), 0::bigint,
  'la demande acceptée disparaît');
select is((select count(*) from public.cases where last_name = 'Kaci'
    and agency_id = (select agency_a from ctx)), 1::bigint,
  'un seul dossier');
select throws_ok(
  $$select public.create_case(gen_random_uuid(), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', (select a1 from camps),
      '22222222-2222-2222-2222-222222222222', pg_temp.fields('Amine', 'Kaci'),
      null, null, null, null, null, (select id from kept))$$,
  'P0002', null, 'une demande déjà traitée ne crée pas un second dossier');
select is((select count(*) from public.cases where last_name = 'Kaci'
    and agency_id = (select agency_a from ctx)), 1::bigint,
  'toujours un seul dossier');

select pg_temp.submit(pg_temp.fields('Sara', 'Belkacem'));
select throws_ok(
  $$select public.create_case(gen_random_uuid(), (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333', (select b1 from camps), null,
      pg_temp.fields('Sara', 'Belkacem'), null, null, null, null, null,
      pg_temp.signup('Belkacem'))$$,
  'P0002', null, 'une autre agence n''accepte pas la demande');

-- 8. Une demande ne se modifie pas ; campagne supprimée

select throws_ok($$update public.online_signups set message = 'Changé'$$,
  '42501', null, 'une demande ne se modifie pas');
select public.submit_online_signup('agence-a', a1, pg_temp.fields('Yanis', 'Mohand'), null)
from camps;
select pg_temp.settings(true, 'agence-a', array[(select a2 from camps)]);
select pg_temp.submit(pg_temp.fields('Nadia', 'Ouali'), (select a2 from camps));
select lives_ok(
  $$select public.delete_campaign((select a2 from camps), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  'une campagne sans dossier se supprime malgré ses demandes');
select is((select campaign_id from public.online_signups where id = pg_temp.signup('Ouali')), null,
  'la demande reste, sans campagne');

-- 9. Demandes oubliées après 90 jours

alter table public.online_signups disable trigger online_signups_before_update;
update public.online_signups set created_at = now() - interval '91 days'
where id = pg_temp.signup('Mohand');
alter table public.online_signups enable trigger online_signups_before_update;
update public.agencies set subscription_ends_at = now() - interval '1 minute'
where id = (select agency_a from ctx);

select is((select is_open from public.online_signup_page('agence-a')), false,
  'abonnement expiré : la page est fermée');
select throws_ok($$select pg_temp.submit(pg_temp.fields('X', 'Y'), (select a1 from camps))$$,
  '25006', null, 'abonnement expiré : rien n''est envoyé');
select throws_ok(
  $$select public.delete_online_signup(pg_temp.signup('Ouali'), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  '25006', null, 'abonnement expiré : lecture seule');

select ok(public.purge_old_online_signups() >= 1, 'la purge supprime les vieilles demandes');
select is(pg_temp.signup('Mohand'), null, 'même pour une agence en lecture seule');
select isnt(pg_temp.signup('Ouali'), null, 'les demandes récentes restent');

-- 10. Notifications

insert into public.push_subscriptions (agency_id, user_id, endpoint, p256dh, auth)
select agency_a, v.id, 'https://push.test/' || v.e, repeat('k', 40), repeat('s', 16)
from ctx, (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'p'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'e')) as v(id, e);
update public.agencies set subscription_ends_at = now() + interval '1 month'
where id = (select agency_a from ctx);

select set_eq(
  $$select endpoint from public.push_targets_online_signup((select agency_a from ctx))$$,
  array['https://push.test/p', 'https://push.test/e'],
  'toute l''équipe est prévenue par défaut');
select public.save_notification_preferences(agency_a, '22222222-2222-2222-2222-222222222222',
  true, true, true, false, true, false) from ctx;
select set_eq(
  $$select endpoint from public.push_targets_online_signup((select agency_a from ctx))$$,
  array['https://push.test/p'], 'un membre peut ne plus être prévenu');
select public.save_notification_preferences(agency_a, '22222222-2222-2222-2222-222222222222',
  true, true, true, false, true) from ctx;
select is((select online_signups from public.notification_preferences
    where user_id = '22222222-2222-2222-2222-222222222222'), false,
  'sans ce choix, l''ancien appel garde la valeur enregistrée');
select is((select count(*) from public.push_targets_online_signup((select agency_b from ctx))),
  0::bigint, 'les autres agences ne reçoivent rien');

select * from finish();
rollback;
