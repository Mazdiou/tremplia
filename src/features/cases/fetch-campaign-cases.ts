import type { SupabaseClient } from "@supabase/supabase-js";

export type TreeCase = {
  id: string;
  campaign_id: string;
  first_name: string;
  last_name: string;
  education_level: string;
  status: string;
  assigned_to: string | null;
};

export type TreeCaseGroup = { case_id: string; group_id: string };

export type CampaignCases = { cases: TreeCase[]; caseGroups: TreeCaseGroup[] };

const CASE_COLUMNS =
  "id, campaign_id, first_name, last_name, education_level, status, assigned_to";

// Supabase renvoie au plus 1000 lignes par requête (réglage max_rows). On lit
// donc par pages de 500, triées sur une colonne stable, jusqu'à la dernière.
// Utilisé par le serveur (campagne ouverte par défaut) et par le navigateur
// (autres campagnes, à l'ouverture). Lecture via le RLS dans les deux cas.
const PAGE_SIZE = 500;

async function readAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error("lecture impossible");
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}

export async function fetchCampaignCases(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CampaignCases> {
  const [cases, caseGroups] = await Promise.all([
    readAll<TreeCase>((from, to) =>
      supabase
        .from("cases")
        .select(CASE_COLUMNS)
        .eq("campaign_id", campaignId)
        .order("id")
        .range(from, to),
    ),
    readAll<TreeCaseGroup>((from, to) =>
      supabase
        .from("case_groups")
        .select("case_id, group_id")
        .eq("campaign_id", campaignId)
        .order("case_id")
        .order("group_id")
        .range(from, to),
    ),
  ]);
  return { cases, caseGroups };
}
