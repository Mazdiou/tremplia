-- Migration : case_stats
-- Nombre de dossiers regroupés par campagne, statut, niveau et responsable.
-- Les pages qui affichent des compteurs (tableau de bord, campagnes, nouveau
-- dossier) lisent cette vue en une requête au lieu d'une requête par
-- compteur.
-- security_invoker : la vue lit cases avec les droits de l'appelant, donc
-- à travers le RLS ; une agence ne compte que ses propres dossiers.

create view public.case_stats
with (security_invoker = true)
as
select
  campaign_id,
  status,
  education_level,
  assigned_to,
  count(*)::integer as cases,
  (count(*) filter (where created_at >= now() - interval '7 days'))::integer
    as created_last_week
from public.cases
group by campaign_id, status, education_level, assigned_to;

grant select on public.case_stats to authenticated;
