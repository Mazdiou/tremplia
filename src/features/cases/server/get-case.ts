import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { CaseFieldsRecord } from "../case-record";
import type { CaseStatus, ExternalAccountStatus } from "../labels";

export type CaseRow = CaseFieldsRecord & {
  id: string;
  campaign_id: string;
  assigned_to: string | null;
  status: CaseStatus;
  created_at: string;
};

export type CaseExternalAccount = {
  id: string;
  platform: string;
  url: string | null;
  login: string | null;
  // « existing » a toujours un mot de passe (garanti par la base)
  status: ExternalAccountStatus;
};

export type CaseGroup = { id: string; name: string };

// Mis en cache pour la durée de la requête : le layout et les onglets
// partagent la même lecture. Lecture via le RLS : un dossier d'une autre
// agence n'est jamais trouvé (donc « introuvable » partout).
export const getCase = cache(async (id: string) => {
  if (!z.string().uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("cases").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const c = data as CaseRow;

  const [respRes, campRes, groupsRes, caseGroupsRes, accountsRes] = await Promise.all([
    c.assigned_to
      ? supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", c.assigned_to)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("campaigns")
      .select("id, name, status, suggested_platforms")
      .eq("id", c.campaign_id)
      .maybeSingle(),
    supabase
      .from("campaign_groups")
      .select("id, name")
      .eq("campaign_id", c.campaign_id)
      .order("position"),
    supabase.from("case_groups").select("group_id").eq("case_id", id),
    supabase
      .from("case_external_accounts")
      .select("id, platform, url, login, status")
      .eq("case_id", id)
      .order("platform"),
  ]);

  const p = respRes.data as { first_name: string; last_name: string } | null;
  const campaignGroups = (groupsRes.data ?? []) as CaseGroup[];
  const groupIds = new Set((caseGroupsRes.data ?? []).map((g) => g.group_id as string));

  return {
    c,
    responsible: p ? `${p.first_name} ${p.last_name}` : null,
    campaign: campRes.data as {
      id: string;
      name: string;
      status: string;
      suggested_platforms: string[];
    } | null,
    campaignGroups,
    groups: campaignGroups.filter((g) => groupIds.has(g.id)),
    externalAccounts: (accountsRes.data ?? []) as CaseExternalAccount[],
  };
});
