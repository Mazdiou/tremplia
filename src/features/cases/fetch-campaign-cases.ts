import type { SupabaseClient } from "@supabase/supabase-js";

export type TreeCase = {
  id: string;
  campaign_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  education_level: string;
  main_track: string | null;
  schools: boolean;
  status: string;
  assigned_to: string | null;
};

const COLUMNS =
  "id, campaign_id, first_name, last_name, phone, education_level, main_track, schools, status, assigned_to";

// Supabase renvoie au plus 1000 lignes par requête (réglage max_rows). On lit
// donc par pages de 500, triées sur une colonne stable, jusqu'à la dernière.
// Utilisé par le serveur (campagne en cours) et par le navigateur (autres
// campagnes, à l'ouverture). Lecture via le RLS dans les deux cas.
const PAGE_SIZE = 500;

export async function fetchCampaignCases(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<TreeCase[]> {
  const rows: TreeCase[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("cases")
      .select(COLUMNS)
      .eq("campaign_id", campaignId)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as TreeCase[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}
