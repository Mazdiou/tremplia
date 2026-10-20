import "server-only";
import type { z } from "zod";
import { ApiError, dbError } from "@/lib/api-errors";
import { readAll } from "@/lib/supabase/read-all";
import { logActivities, type ActivityEntry } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import type { CampaignStage } from "../stages";
import type { replaceStagesSchema } from "../schemas";
import { reportError } from "@/lib/report-error";

// Étapes des dossiers. Les fonctions SQL revérifient l'acteur et son rôle ;
// l'agence vient toujours de la session.

// Toutes les étapes de l'agence (le RLS filtre)
export async function listAgencyStages(): Promise<CampaignStage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_stages")
    .select("id, campaign_id, name, position")
    .order("position");
  if (error) reportError("[campaign stages list]", error.code);
  return (data ?? []) as CampaignStage[];
}

// Patron seulement. Renvoie le nombre de dossiers déplacés (étapes retirées).
export async function replaceCampaignStages(
  member: Member,
  campaignId: string,
  stages: z.infer<typeof replaceStagesSchema>["stages"],
) {
  const admin = createAdminClient();
  // Dossiers que la fonction SQL déplace (étape retirée, ou aucune étape) :
  // chacun doit le voir dans son historique
  const kept = new Set(stages.flatMap((s) => (s.id ? [s.id] : [])));
  const { data: oldStages, error: stagesError } = await admin
    .from("campaign_stages")
    .select("id")
    .eq("agency_id", member.agencyId)
    .eq("campaign_id", campaignId);
  if (stagesError) throw dbError("stages replace read", stagesError);
  const removed = ((oldStages ?? []) as { id: string }[])
    .map((s) => s.id)
    .filter((id) => !kept.has(id));
  // Les dossiers sans étape vont aussi sur la première, s'il y en a une
  const filters = [
    ...(stages.length > 0 ? ["stage_id.is.null"] : []),
    ...(removed.length > 0 ? [`stage_id.in.(${removed.join(",")})`] : []),
  ];
  const before =
    filters.length === 0
      ? []
      : await readAll<{ id: string; stage_id: string | null }>((from, to) =>
          admin
            .from("cases")
            .select("id, stage_id")
            .eq("agency_id", member.agencyId)
            .eq("campaign_id", campaignId)
            .or(filters.join(","))
            .order("id")
            .range(from, to),
        ).catch(() => {
          throw new ApiError(500, "Impossible de lire les dossiers de la campagne");
        });
  const previousStage = new Map(before.map((c) => [c.id, c.stage_id]));

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

  const entries: ActivityEntry[] = [
    {
      agencyId: member.agencyId,
      actorId: member.userId,
      action: "campaign.stages_updated",
      targetType: "campaign",
      targetId: campaignId,
      details: { stages: stages.length, cases_moved: moved },
    },
  ];
  // Étape d'arrivée relue par lots (adresse de requête courte)
  const ids = [...previousStage.keys()];
  for (let i = 0; i < ids.length; i += 200) {
    const { data: after, error: afterError } = await admin
      .from("cases")
      .select("id, stage_id")
      .eq("agency_id", member.agencyId)
      .in("id", ids.slice(i, i + 200));
    if (afterError) reportError("[stages replace log]", afterError.code);
    for (const c of (after ?? []) as { id: string; stage_id: string | null }[]) {
      const from = previousStage.get(c.id) ?? null;
      if (c.stage_id === from) continue;
      entries.push({
        agencyId: member.agencyId,
        actorId: member.userId,
        caseId: c.id,
        action: "case.stage_changed",
        targetType: "case",
        targetId: c.id,
        details: { from, to: c.stage_id, stages_updated: true },
      });
    }
  }
  await logActivities(admin, entries);
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
