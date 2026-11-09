begin;
select plan(8);

-- Seules les tables utiles à l'agence sont diffusées en temps réel ; le
-- cloisonnement repose sur leur RLS (lecture réservée à l'agence).
select set_eq(
  $$ select tablename::text from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' $$,
  array['case_document_requests', 'case_messages', 'case_student_reviews', 'case_tasks',
        'online_signups'],
  'publication temps réel : messages, réponses et pièces du candidat, tâches, inscriptions en ligne'
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
select ok(
  (select relrowsecurity from pg_class where oid = 'public.case_document_requests'::regclass),
  'case_document_requests : RLS active'
);

-- Identité complète : la suppression d'une tâche passe le filtre agency_id
-- de l'abonnement (le RLS limite toujours l'événement à l'id)
select is(
  (select relreplident::text from pg_class where oid = 'public.case_tasks'::regclass),
  'f',
  'case_tasks : identité complète pour diffuser les suppressions'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.online_signups'::regclass),
  'online_signups : RLS active'
);
select is(
  (select relreplident::text from pg_class where oid = 'public.online_signups'::regclass),
  'f',
  'online_signups : identité complète pour diffuser les demandes refusées ou acceptées'
);

select * from finish();
rollback;
