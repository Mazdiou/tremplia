import "server-only";
import { dbError } from "@/lib/api-errors";
import { logActivities, type ActivityEntry } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BulkCasesInput } from "../schemas";

// Actions groupées sur des dossiers de l'agence de l'appelant. Les fonctions
// SQL revérifient l'acteur, son rôle et chaque dossier, et refusent tout si
// un seul ne convient pas. Renvoie le nombre de dossiers vraiment changés.
export async function applyBulkAction(member: Member, input: BulkCasesInput): Promise<number> {
  const admin = createAdminClient();
  const base = {
    p_case_ids: input.caseIds,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
  };

  let entries: ActivityEntry[];
  if (input.action.type === "stage") {
    const stageId = input.action.stageId;
    const { data, error } = await admin.rpc("set_cases_stage", {
      ...base,
      p_stage_id: stageId,
    });
    if (error) {
      throw dbError("cases bulk stage", error, {
        P0002: "Un des dossiers est introuvable",
        "23503": "Cette étape n'est pas celle de la campagne de tous les dossiers sélectionnés",
      });
    }
    const rows = (data ?? []) as { changed_id: string; previous_stage_id: string | null }[];
    entries = rows.map((r) => ({
      agencyId: member.agencyId,
      actorId: member.userId,
      caseId: r.changed_id,
      action: "case.stage_changed",
      targetType: "case",
      targetId: r.changed_id,
      details: { from: r.previous_stage_id, to: stageId, bulk: true },
    }));
  } else {
    const assignedTo = input.action.assignedTo;
    const { data, error } = await admin.rpc("set_cases_assignee", {
      ...base,
      p_assigned_to: assignedTo,
    });
    if (error) {
      throw dbError("cases bulk assign", error, {
        P0002: "Un des dossiers est introuvable",
        "22023": "Responsable invalide (compte inactif ou d'une autre agence)",
      });
    }
    const rows = (data ?? []) as { changed_id: string; previous_assignee: string | null }[];
    entries = rows.map((r) => ({
      agencyId: member.agencyId,
      actorId: member.userId,
      caseId: r.changed_id,
      action: "case.assigned",
      targetType: "case",
      targetId: r.changed_id,
      details: { from: r.previous_assignee, to: assignedTo, bulk: true },
    }));
  }

  await logActivities(admin, entries);
  return entries.length;
}
