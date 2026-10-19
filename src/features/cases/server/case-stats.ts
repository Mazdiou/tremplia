import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CaseStatRow } from "../case-stats";
import { readAll } from "@/lib/supabase/read-all";
import { reportError } from "@/lib/report-error";

// Lignes de la vue case_stats (lecture via le RLS : seuls les dossiers de
// l'agence sont comptés), pour toutes les campagnes ou celles indiquées.
// Triées sur toutes les colonnes de regroupement : ordre stable entre pages.
export async function listCaseStats(campaignIds?: string[]): Promise<CaseStatRow[]> {
  if (campaignIds?.length === 0) return [];
  const supabase = await createClient();
  try {
    return await readAll<CaseStatRow>((from, to) => {
      const query = supabase
        .from("case_stats")
        .select(
          "campaign_id, status, education_level, assigned_to, cases, created_last_week, remaining, owing, fee_unset",
        )
        .order("campaign_id")
        .order("status")
        .order("education_level")
        .order("assigned_to", { nullsFirst: true })
        .range(from, to);
      return campaignIds ? query.in("campaign_id", campaignIds) : query;
    });
  } catch {
    reportError("[case stats]", "lecture impossible");
    return [];
  }
}
