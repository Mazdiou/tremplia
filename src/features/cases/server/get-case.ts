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
  // Étape du dossier dans sa campagne (vide : la campagne n'a pas d'étape)
  stage_id: string | null;
  // Montant convenu avec le candidat, en dinars (vide : pas encore fixé)
  agreed_amount: number | null;
  // Total payé, et reste à payer calculé par la base (vide si pas de montant)
  paid_amount: number;
  remaining_amount: number | null;
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

export type CaseStage = { id: string; name: string };

// Mis en cache pour la durée de la requête : le layout et les onglets
// partagent la même lecture. Lecture via le RLS : un dossier d'une autre
// agence n'est jamais trouvé (donc « introuvable » partout).
export const getCase = cache(async (id: string) => {
  if (!z.string().uuid().safeParse(id).success) return null;

  // Une seule requête : le dossier et ce qui s'y rattache, par ses liens
  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select(
      `*,
      responsible:profiles!cases_assigned_to_fk(first_name, last_name),
      campaign:campaigns!cases_campaign_fk(id, name, status, suggested_platforms, default_fee,
        campaign_groups(id, name, position), campaign_stages(id, name, position)),
      case_groups!case_groups_case_fk(group_id),
      case_external_accounts!case_external_accounts_case_fk(id, platform, url, login, status)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const {
    responsible: p,
    campaign: camp,
    case_groups: caseGroups,
    case_external_accounts: accounts,
    ...c
  } = data as unknown as CaseRow & {
    responsible: { first_name: string; last_name: string } | null;
    campaign: {
      id: string;
      name: string;
      status: string;
      suggested_platforms: string[];
      default_fee: number | null;
      campaign_groups: (CaseGroup & { position: number })[];
      campaign_stages: (CaseStage & { position: number })[];
    } | null;
    case_groups: { group_id: string }[];
    case_external_accounts: CaseExternalAccount[];
  };

  const { campaign_groups: rawGroups = [], campaign_stages: rawStages = [], ...campaign } =
    camp ?? {};
  const campaignGroups: CaseGroup[] = [...rawGroups]
    .sort((a, b) => a.position - b.position)
    .map((g) => ({ id: g.id, name: g.name }));
  const stages: CaseStage[] = [...rawStages]
    .sort((a, b) => a.position - b.position)
    .map((st) => ({ id: st.id, name: st.name }));
  const groupIds = new Set(caseGroups.map((g) => g.group_id));

  return {
    c: c as CaseRow,
    responsible: p ? `${p.first_name} ${p.last_name}` : null,
    campaign: camp
      ? (campaign as {
          id: string;
          name: string;
          status: string;
          suggested_platforms: string[];
          default_fee: number | null;
        })
      : null,
    campaignGroups,
    stages,
    groups: campaignGroups.filter((g) => groupIds.has(g.id)),
    externalAccounts: [...accounts].sort((a, b) => a.platform.localeCompare(b.platform)),
  };
});
