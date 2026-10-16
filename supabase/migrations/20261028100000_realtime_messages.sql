-- Temps réel : l'agence voit arriver les messages et les réponses du
-- candidat sans recharger la page. Chaque événement passe par le RLS de sa
-- table : un utilisateur ne reçoit que les lignes de sa propre agence.
alter publication supabase_realtime add table public.case_messages, public.case_student_reviews;
