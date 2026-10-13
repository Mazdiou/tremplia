begin;
select plan(45);

-- Agence A : patron (1111), employé (2222) ; agence B : patron (3333)
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'a1@test.local'),
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

select public.add_employee((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222', 'Employe', 'A');

-- Création ------------------------------------------------------------------

create temp table camp as
select public.create_campaign(
  (select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
  'Campus France 2026/2027', 'campus-france-2026-2027', array['Pastel'],
  '[{"label": "Ouverture", "date": "2026-10-01"},
    {"label": "Date limite DAP", "date": "2026-12-15"}]',
  '[{"label": "Pays", "value": "France"}]',
  array['DAP', 'Hors-DAP', 'École']) as id;
grant select on camp to public;

select is(
  (select count(*) from public.campaign_dates where campaign_id = (select id from camp)),
  2::bigint, 'le patron crée une campagne avec ses dates');
select is(
  (select count(*) from public.campaign_infos where campaign_id = (select id from camp)),
  1::bigint, 'la campagne a ses informations');
select is(
  (select array_agg(name order by position) from public.campaign_groups
    where campaign_id = (select id from camp)),
  array['DAP', 'Hors-DAP', 'École'], 'les groupes sont créés dans l''ordre');
select is(
  (select status from public.campaigns where id = (select id from camp)),
  'active', 'une nouvelle campagne est active');

select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Italie', null, '{}', '[]', '[]', '{}')$$,
  '42501', null, 'un employé ne crée pas de campagne');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '33333333-3333-3333-3333-333333333333', 'Italie', null, '{}', '[]', '[]', '{}')$$,
  '42501', null, 'le patron d''une autre agence ne crée pas de campagne ici');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'CAMPUS FRANCE 2026/2027', null,
      '{}', '[]', '[]', '{}')$$,
  '23505', null, 'deux campagnes du même nom (majuscules comprises) sont refusées');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Autre nom', 'campus-france-2026-2027',
      '{}', '[]', '[]', '{}')$$,
  '23505', null, 'un modèle ne s''importe qu''une fois par agence');
select lives_ok(
  $$select public.create_campaign((select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333', 'Campus France 2026/2027',
      'campus-france-2026-2027', '{}', '[]', '[]', '{}')$$,
  'une autre agence peut utiliser le même nom et le même modèle');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', ' Italie', null, '{}', '[]', '[]', '{}')$$,
  '23514', null, 'un nom avec des espaces autour est refusé');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Italie', null,
      array['Pastel', 'PASTEL'], '[]', '[]', '{}')$$,
  '23514', null, 'une plateforme suggérée en double est refusée');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Italie', null,
      array(select 'P' || n from generate_series(1, 11) as n), '[]', '[]', '{}')$$,
  '23514', null, 'plus de 10 plateformes suggérées sont refusées');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Italie', null, '{}',
      '{"label": "x"}', '[]', '{}')$$,
  '22023', null, 'des dates qui ne sont pas une liste sont refusées');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Italie', null, '{}',
      '[{"label": "Ouverture", "date": "2026-13-01"}]', '[]', '{}')$$,
  '22008', null, 'une date impossible est refusée');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Italie', null, '{}', '[]', '[]',
      array['DAP', 'dap'])$$,
  '23505', null, 'deux groupes du même nom sont refusés');
select is(
  (select count(*) from public.campaigns where name = 'Italie'),
  0::bigint, 'une création refusée ne laisse aucune campagne');

-- Modification --------------------------------------------------------------

select throws_ok(
  $$select public.update_campaign((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Nouveau nom', '{}', '[]', '[]')$$,
  '42501', null, 'un employé ne modifie pas une campagne');
select throws_ok(
  $$select public.update_campaign((select id from camp), (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333', 'Nouveau nom', '{}', '[]', '[]')$$,
  'P0002', null, 'le patron B ne trouve pas la campagne de l''agence A');
select lives_ok(
  $$select public.update_campaign((select id from camp), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Campus France 26/27',
      array['Pastel', 'Études en France'],
      '[{"label": "Fin des entretiens", "date": "2027-03-15"}]', '[]')$$,
  'le patron modifie sa campagne');
select is(
  (select array_agg(label) from public.campaign_dates
    where campaign_id = (select id from camp)),
  array['Fin des entretiens'], 'les dates sont remplacées');

-- Groupes : tout membre actif -----------------------------------------------

create temp table grp as
select public.create_campaign_group((select id from camp), (select agency_a from ctx),
  '22222222-2222-2222-2222-222222222222', 'Visa') as id;
grant select on grp to public;

select is(
  (select position from public.campaign_groups where id = (select id from grp)),
  3, 'un employé crée un groupe, placé après les autres');
select throws_ok(
  $$select public.create_campaign_group((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'VISA')$$,
  '23505', null, 'deux groupes du même nom sont refusés');
select throws_ok(
  $$select public.create_campaign_group((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', repeat('x', 81))$$,
  '23514', null, 'un nom de groupe de plus de 80 caractères est refusé');
select throws_ok(
  $$select public.create_campaign_group((select id from camp), (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333', 'Intrus')$$,
  'P0002', null, 'une autre agence ne crée pas de groupe dans cette campagne');
select lives_ok(
  $$select public.rename_campaign_group((select id from grp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Visa étudiant')$$,
  'un employé renomme un groupe');
select throws_ok(
  $$select public.rename_campaign_group((select id from grp), (select agency_b from ctx),
      '33333333-3333-3333-3333-333333333333', 'Pirate')$$,
  'P0002', null, 'une autre agence ne renomme pas ce groupe');

-- Archivage -----------------------------------------------------------------

select throws_ok(
  $$select public.set_campaign_status((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'archived')$$,
  '42501', null, 'un employé n''archive pas une campagne');
select is(
  public.set_campaign_status((select id from camp), (select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111', 'archived'),
  true, 'le patron archive une campagne');
select ok(
  (select archived_at is not null from public.campaigns where id = (select id from camp)),
  'la date d''archivage est renseignée par la base');
select throws_ok(
  $$select public.update_campaign((select id from camp), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111', 'Autre', '{}', '[]', '[]')$$,
  '55000', null, 'les réglages d''une campagne archivée sont figés');
select throws_ok(
  $$select public.create_campaign_group((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Nouveau')$$,
  '55000', null, 'une campagne archivée ne reçoit plus de groupe');
select throws_ok(
  $$select public.rename_campaign_group((select id from grp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222', 'Autre')$$,
  '55000', null, 'les groupes d''une campagne archivée ne se renomment pas');
select throws_ok(
  $$select public.delete_campaign_group((select id from grp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  '55000', null, 'les groupes d''une campagne archivée ne se suppriment pas');
select throws_ok(
  $$insert into public.campaign_dates (agency_id, campaign_id, label, date)
    select agency_a, (select id from camp), 'Ajout', '2027-01-01' from ctx$$,
  '55000', null, 'même la base refuse une date ajoutée à une campagne archivée');
select is(
  public.set_campaign_status((select id from camp), (select agency_a from ctx),
    '11111111-1111-1111-1111-111111111111', 'active'),
  true, 'le patron réactive la campagne');
select ok(
  (select archived_at is null from public.campaigns where id = (select id from camp)),
  'la date d''archivage est effacée à la réactivation');

-- Suppression ---------------------------------------------------------------

select lives_ok(
  $$select public.delete_campaign_group((select id from grp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  'un employé supprime un groupe');
select throws_ok(
  $$select public.delete_campaign((select id from camp), (select agency_a from ctx),
      '22222222-2222-2222-2222-222222222222')$$,
  '42501', null, 'un employé ne supprime pas une campagne');

select public.set_campaign_status((select id from camp), (select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', 'archived');
select lives_ok(
  $$select public.delete_campaign((select id from camp), (select agency_a from ctx),
      '11111111-1111-1111-1111-111111111111')$$,
  'le patron supprime une campagne vide, même archivée');
select is(
  (select count(*) from public.campaign_groups where campaign_id = (select id from camp))
  + (select count(*) from public.campaign_dates where campaign_id = (select id from camp)),
  0::bigint, 'ses groupes et ses dates partent avec elle');

-- Lecture (RLS) -------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$insert into public.campaigns (agency_id, name, created_by)
    values (gen_random_uuid(), 'Directe', gen_random_uuid())$$,
  '42501', null, 'le navigateur ne crée pas de campagne directement');

reset role;
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*) from public.campaigns), 1::bigint,
  'le patron B ne voit que la campagne de son agence');

reset role;
select public.create_campaign((select agency_a from ctx),
  '11111111-1111-1111-1111-111111111111', 'Italie', null, '{}',
  '[{"label": "Ouverture", "date": "2026-10-01"}]',
  '[{"label": "Pays", "value": "Italie"}]', array['Licence']);
select set_config('request.jwt.claims',
  '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
set local role authenticated;

select is(
  (select count(*) from public.campaign_dates)
  + (select count(*) from public.campaign_infos)
  + (select count(*) from public.campaign_groups),
  0::bigint, 'le patron B ne voit ni dates, ni informations, ni groupes de l''agence A');

reset role;
set local role service_role;

select throws_ok(
  $$update public.campaigns set status = 'archived'$$,
  '42501', null, 'le serveur n''archive pas une campagne sans passer par la fonction');

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.campaign_groups$$,
  '42501', null, 'un visiteur ne lit pas les groupes');

select * from finish();
rollback;
