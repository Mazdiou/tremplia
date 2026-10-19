import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CampaignDate } from "../timeline";
import type { CampaignStatus } from "../labels";
import { reportError } from "@/lib/report-error";

// Lectures via le RLS : seules les campagnes de l'agence reviennent.

export type CampaignSummary = {
  id: string;
  name: string;
  status: CampaignStatus;
  template_key: string | null;
};

type GroupSummary = {
  id: string;
  campaign_id: string;
  name: string;
  position: number;
};

// Actives d'abord, puis par nom
export async function listCampaigns(): Promise<CampaignSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, status, template_key")
    .order("name");
  if (error) reportError("[campaigns list]", error.code);
  return ((data ?? []) as CampaignSummary[]).sort(
    (a, b) => Number(a.status === "archived") - Number(b.status === "archived"),
  );
}

export async function listGroups(campaignIds: string[]): Promise<GroupSummary[]> {
  if (campaignIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_groups")
    .select("id, campaign_id, name, position")
    .in("campaign_id", campaignIds)
    .order("position");
  if (error) reportError("[campaign groups list]", error.code);
  return (data ?? []) as GroupSummary[];
}

// Tous les groupes de l'agence (le RLS filtre), sans attendre la liste des
// campagnes : lus en même temps qu'elle
export async function listAgencyGroups(): Promise<GroupSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_groups")
    .select("id, campaign_id, name, position")
    .order("position");
  if (error) reportError("[campaign groups list]", error.code);
  return (data ?? []) as GroupSummary[];
}

export async function listCampaignDates(
  campaigns: Pick<CampaignSummary, "id" | "name">[],
): Promise<CampaignDate[]> {
  if (campaigns.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_dates")
    .select("campaign_id, label, date")
    .in(
      "campaign_id",
      campaigns.map((c) => c.id),
    );
  if (error) reportError("[campaign dates list]", error.code);
  const names = new Map(campaigns.map((c) => [c.id, c.name]));
  return (data ?? []).map((d) => ({
    campaignId: d.campaign_id as string,
    campaignName: names.get(d.campaign_id as string) ?? "",
    label: d.label as string,
    date: d.date as string,
  }));
}
