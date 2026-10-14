import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CaseStatRow } from "../case-stats";

// Supabase renvoie au plus 1000 lignes par requête : lecture par pages, triée
// sur toutes les colonnes de regroupement (ordre stable), jusqu'à la
// dernière. En pratique une seule page.
const PAGE_SIZE = 1000;

// Lignes de la vue case_stats (lecture via le RLS : seuls les dossiers de
// l'agence sont comptés), pour toutes les campagnes ou celles indiquées.
export async function listCaseStats(campaignIds?: string[]): Promise<CaseStatRow[]> {
  if (campaignIds?.length === 0) return [];
  const supabase = await createClient();
  const rows: CaseStatRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("case_stats")
      .select(
        "campaign_id, status, education_level, assigned_to, cases, created_last_week, remaining, owing, fee_unset",
      )
      .order("campaign_id")
      .order("status")
      .order("education_level")
      .order("assigned_to", { nullsFirst: true })
      .range(from, from + PAGE_SIZE - 1);
    if (campaignIds) query = query.in("campaign_id", campaignIds);
    const { data, error } = await query;
    if (error) {
      console.error("[case stats]", error.code);
      return rows;
    }
    const batch = (data ?? []) as CaseStatRow[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}
