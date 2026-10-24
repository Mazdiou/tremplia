begin;
select plan(22);

-- Agence A : patron (1111), employé (2222) ; agence B : patron (3333)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'set-a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'set-a1@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'set-b0@test.local');

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

-- 1. Profil de l'agence

select lives_ok(
  $$select public.update_agency_profile((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Agence Alpha', 'Blida', '0555000009')$$,
  'le patron modifie le profil de son agence');

select is(
  (select name || ' / ' || city || ' / ' || phone from public.agencies
    where id = (select agency_a from ctx)),
  'Agence Alpha / Blida / 0555000009', 'le profil est enregistré');

select throws_ok(
  $$select public.update_agency_profile((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Autre', 'Alger', '0555000001')$$,
  '42501', null, 'un employé ne modifie pas le profil');

select throws_ok(
  $$select public.update_agency_profile((select agency_b from ctx),
      '11111111-1111-1111-1111-111111111111', 'Autre', 'Alger', '0555000001')$$,
  '42501', null, 'le patron ne modifie pas une autre agence');

select throws_ok(
  $$select public.update_agency_profile((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', ' Espaces ', 'Alger', '0555000001')$$,
  '23514', null, 'un nom avec des espaces autour est refusé');

-- 2. Valeurs par défaut des campagnes

select is(
  (select default_stages is null and default_platforms = '{}' and default_fee is null
     from public.agencies where id = (select agency_a from ctx)),
  true, 'par défaut : étapes de l''application, ni plateforme ni tarif');

select lives_ok(
  $$select public.update_agency_defaults((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 150000,
      array['Pastel', 'Parcoursup'], array['Dossier', 'Visa'])$$,
  'le patron choisit les valeurs par défaut');

select is(
  (select default_fee::text || ' ' || array_to_string(default_platforms, ',')
       || ' ' || array_to_string(default_stages, ',')
     from public.agencies where id = (select agency_a from ctx)),
  '150000 Pastel,Parcoursup Dossier,Visa', 'les valeurs par défaut sont enregistrées');

select lives_ok(
  $$select public.update_agency_defaults((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', null, '{}', '{}')$$,
  'aucune étape par défaut est permis');

select is(
  (select default_stages from public.agencies where id = (select agency_a from ctx)),
  '{}'::text[], 'une liste vide reste vide (pas la liste de l''application)');

select throws_ok(
  $$select public.update_agency_defaults((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', null, '{}', array['Visa', 'VISA'])$$,
  '23514', null, 'deux étapes du même nom sont refusées');

select throws_ok(
  $$select public.update_agency_defaults((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', null, '{}',
      (select array_agg('Étape ' || n) from generate_series(1, 16) as n))$$,
  '23514', null, 'plus de 15 étapes sont refusées');

select throws_ok(
  $$select public.update_agency_defaults((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', -1, '{}', null)$$,
  '23514', null, 'un tarif négatif est refusé');

select throws_ok(
  $$select public.update_agency_defaults((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', null, '{}', null)$$,
  '42501', null, 'un employé ne change pas les valeurs par défaut');

-- 3. Nom d'un membre

select lives_ok(
  $$select public.update_own_name((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Amina', 'Benali')$$,
  'un employé corrige son nom');

select is(
  (select first_name || ' ' || last_name from public.profiles
    where id = '22222222-2222-2222-2222-222222222222'),
  'Amina Benali', 'le nom est enregistré');

select throws_ok(
  $$select public.update_own_name((select agency_b from ctx),
      '22222222-2222-2222-2222-222222222222', 'Amina', 'Benali')$$,
  '42501', null, 'pas au nom d''une autre agence');

-- 4. Lecture seule

update public.agencies set subscription_ends_at = now() - interval '1 minute'
where id = (select agency_a from ctx);

select throws_ok(
  $$select public.update_agency_profile((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Agence A', 'Alger', '0555000001')$$,
  '25006', null, 'expirée : le profil ne se modifie plus');

select throws_ok(
  $$select public.update_agency_defaults((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', null, '{}', null)$$,
  '25006', null, 'expirée : les valeurs par défaut ne se modifient plus');

select throws_ok(
  $$select public.update_own_name((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Nouveau', 'Nom')$$,
  '25006', null, 'expirée : le nom ne se modifie plus');

-- 5. Essais de mot de passe

select public.password_check_failed('11111111-1111-1111-1111-111111111111')
from generate_series(1, 5);

select throws_ok(
  $$select public.password_check_allowed('11111111-1111-1111-1111-111111111111')$$,
  '54000', null, 'après 5 échecs en 15 minutes, le compte est bloqué');

update public.password_check_failures set failed_at = now() - interval '16 minutes'
where user_id = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$select public.password_check_allowed('11111111-1111-1111-1111-111111111111')$$,
  'les échecs de plus de 15 minutes ne comptent plus');

select * from finish();
rollback;
