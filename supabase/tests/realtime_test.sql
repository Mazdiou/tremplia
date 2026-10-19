begin;
select plan(5);

-- Seules les tables utiles à l'agence sont diffusées en temps réel ; le
-- cloisonnement repose sur leur RLS (lecture réservée à l'agence).
select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['case_messages', 'case_student_reviews', 'case_tasks'],
  'publication temps réel : messages et réponses du candidat, tâches'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.case_messages'::regclass),
  'case_messages : RLS active'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.case_student_reviews'::regclass),
  'case_student_reviews : RLS active'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.case_tasks'::regclass),
  'case_tasks : RLS active'
);

-- Identité complète : la suppression d'une tâche passe le filtre agency_id
-- de l'abonnement (le RLS limite toujours l'événement à l'id)
select is(
  (select relreplident::text from pg_class where oid = 'public.case_tasks'::regclass),
  'f',
  'case_tasks : identité complète pour diffuser les suppressions'
);

select * from finish();
rollback;
