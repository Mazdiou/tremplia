begin;
select plan(7);

-- Patron A (bientôt administrateur), patron B
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a0@test.local'),
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

create function pg_temp.state(a uuid) returns text language sql as $$
  select state from public.agency_subscription(a) $$;

-- Les deux agences ont dépassé leur date de fin
update public.agencies set subscription_ends_at = now() - interval '1 day'
where id in ((select agency_a from ctx), (select agency_b from ctx));

select is(pg_temp.state((select agency_a from ctx)), 'expired', 'sans droit d''administrateur, A est expirée');

insert into public.platform_admins (user_id) values ('11111111-1111-1111-1111-111111111111');

select is(pg_temp.state((select agency_a from ctx)), 'exempt',
  'l''agence de l''administrateur est exemptée');
select lives_ok(
  $$select public.create_campaign((select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      'Campagne A', null, '{}', '[]', '[]', '{}')$$,
  'exemptée : elle écrit malgré la date passée');
select is(pg_temp.state((select agency_b from ctx)), 'expired', 'les autres agences ne sont pas concernées');
select throws_ok(
  $$select public.create_campaign((select agency_b from ctx), '33333333-3333-3333-3333-333333333333',
      'Campagne B', null, '{}', '[]', '[]', '{}')$$,
  '25006', null, 'une autre agence expirée reste en lecture seule');

delete from public.platform_admins where user_id = '11111111-1111-1111-1111-111111111111';

select is(pg_temp.state((select agency_a from ctx)), 'expired',
  'droit retiré : A revient au régime normal');
select throws_ok(
  $$select public.create_campaign((select agency_a from ctx), '11111111-1111-1111-1111-111111111111',
      'Campagne A2', null, '{}', '[]', '[]', '{}')$$,
  '25006', null, 'et redevient en lecture seule');

select * from finish();
rollback;
