import type { SupabaseClient } from "@supabase/supabase-js";
import { readAll } from "@/lib/supabase/read-all";

export type TreeCase = {
  id: string;
  campaign_id: string;
  first_name: string;
  last_name: string;
  education_level: string;
  status: string;
  assigned_to: string | null;
  // Paiements : montant convenu (vide : pas fixé) et reste à payer
  agreed_amount: number | null;
  remaining_amount: number | null;
  // Étape dans sa campagne (vide : la campagne n'a pas d'étape)
  stage_id: string | null;
};

export type TreeCaseGroup = { case_id: string; group_id: string };

export type CampaignCases = { cases: TreeCase[]; caseGroups: TreeCaseGroup[] };

const CASE_COLUMNS =
  "id, campaign_id, first_name, last_name, education_level, status, assigned_to, agreed_amount, remaining_amount, stage_id";

// Dossiers d'une campagne et leur classement, lus via le RLS : par le serveur
// (campagne ouverte par défaut) ou par le navigateur (autres campagnes, à
// l'ouverture)
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
