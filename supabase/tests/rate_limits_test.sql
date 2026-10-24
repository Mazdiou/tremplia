begin;
select plan(13);

-- Empreintes factices (64 caractères hexadécimaux), une par « adresse »
create function pg_temp.h(n text) returns text language sql as $$ select md5(n) || md5(n) $$;

-- Les essais déjà enregistrés dans la base ne doivent pas fausser les
-- comptes (tout est annulé à la fin du test)
delete from public.student_login_failures;
delete from public.registration_attempts;

-- 1. Connexion des candidats : limite globale

-- 199 échecs récents venus de 199 adresses différentes
insert into public.student_login_failures (ip_hash)
select pg_temp.h('ip-' || n) from generate_series(1, 199) as n;

select is(
  (select count(*) from public.student_login(pg_temp.h('code-faux'), pg_temp.h('nouvelle-1'))),
  0::bigint, 'une nouvelle adresse peut encore essayer (200e échec)');

select throws_ok(
  $$select * from public.student_login(pg_temp.h('code-faux'), pg_temp.h('nouvelle-2'))$$,
  '54000', null, 'au-delà de 200 échecs en 15 minutes, tout le service est bloqué');

update public.student_login_failures set failed_at = now() - interval '16 minutes';

select lives_ok(
  $$select * from public.student_login(pg_temp.h('code-faux'), pg_temp.h('nouvelle-3'))$$,
  'les échecs de plus de 15 minutes ne comptent plus');

-- La limite par adresse est inchangée : 10 échecs
delete from public.student_login_failures;
select public.student_login(pg_temp.h('code-faux'), pg_temp.h('meme-adresse'))
from generate_series(1, 10);
select throws_ok(
  $$select * from public.student_login(pg_temp.h('code-faux'), pg_temp.h('meme-adresse'))$$,
  '54000', null, 'toujours 10 échecs au plus par adresse');

-- 2. Inscriptions

select lives_ok(
  $$select public.register_attempt(pg_temp.h('agence-1')) from generate_series(1, 3)$$,
  'trois inscriptions par heure depuis une même adresse');

select throws_ok(
  $$select public.register_attempt(pg_temp.h('agence-1'))$$,
  '54000', null, 'la quatrième est refusée');

select lives_ok(
  $$select public.register_attempt(pg_temp.h('agence-2'))$$,
  'une autre adresse peut s''inscrire');

update public.registration_attempts set attempted_at = now() - interval '61 minutes';

select lives_ok(
  $$select public.register_attempt(pg_temp.h('agence-1'))$$,
  'une heure plus tard, la première adresse peut réessayer');

-- Limite globale : 30 essais par heure, toutes adresses confondues
delete from public.registration_attempts;
select public.register_attempt(pg_temp.h('robot-' || n)) from generate_series(1, 30) as n;

select throws_ok(
  $$select public.register_attempt(pg_temp.h('robot-31'))$$,
  '54000', null, 'au-delà de 30 inscriptions par heure, tout est refusé');

select is((select count(*) from public.registration_attempts), 30::bigint,
  'un essai refusé n''est pas compté');

update public.registration_attempts set attempted_at = now() - interval '2 days';
select public.register_attempt(pg_temp.h('apres'));
select is((select count(*) from public.registration_attempts), 1::bigint,
  'les essais de plus d''un jour sont effacés');

-- 3. Droits

set local role authenticated;

select throws_ok(
  $$select public.register_attempt(md5('x') || md5('x'))$$,
  '42501', null, 'un utilisateur connecté n''appelle pas la fonction');

select throws_ok(
  $$select count(*) from public.registration_attempts$$,
  '42501', null, 'ni ne lit les essais');

reset role;

select * from finish();
rollback;
