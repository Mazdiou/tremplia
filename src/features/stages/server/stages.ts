import "server-only";
import type { z } from "zod";
import { dbError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import type { CampaignStage } from "../stages";
import type { replaceStagesSchema } from "../schemas";

// Étapes des dossiers. Les fonctions SQL revérifient l'acteur et son rôle ;
// l'agence vient toujours de la session.

// Toutes les étapes de l'agence (le RLS filtre)
export async function listAgencyStages(): Promise<CampaignStage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_stages")
    .select("id, campaign_id, name, position")
    .order("position");
  if (error) console.error("[campaign stages list]", error.code);
  return (data ?? []) as CampaignStage[];
}

// Patron seulement. Renvoie le nombre de dossiers déplacés (étapes retirées).
export async function replaceCampaignStages(
  member: Member,
  campaignId: string,
  stages: z.infer<typeof replaceStagesSchema>["stages"],
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("replace_campaign_stages", {
    p_campaign_id: campaignId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_stages: stages,
  });
  if (error) {
    throw dbError("stages replace", error, {
      P0002: "Campagne introuvable",
      "22023": "Étapes invalides (deux noms identiques, ou étape d'une autre campagne)",
    });
  }
  const moved = typeof data === "number" ? data : 0;
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "campaign.stages_updated",
    targetType: "campaign",
    targetId: campaignId,
    details: { stages: stages.length, cases_moved: moved },
  });
  return moved;
}

// Tout membre actif
export async function setCaseStage(auth: AuthorizedCase, caseId: string, stageId: string) {
  const { admin, member } = auth;
  const { data: previous, error } = await admin.rpc("set_case_stage", {
    p_case_id: caseId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_stage_id: stageId,
  });
  if (error) {
    throw dbError("cases stage", error, {
      P0002: "Dossier introuvable",
      "23503": "Cette étape n'est pas celle de la campagne du dossier",
    });
  }

  if (previous !== stageId) {
    await logCaseActivity(auth, caseId, {
      action: "case.stage_changed",
      targetType: "case",
      targetId: caseId,
      details: { from: (previous as string | null) ?? null, to: stageId },
    });
  }
}
