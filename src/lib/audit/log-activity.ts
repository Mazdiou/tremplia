import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityAction } from "./actions";

type Entry = {
  agencyId: string;
  actorId: string | null;
  action: ActivityAction;
  targetType?: string;
  targetId?: string;
  caseId?: string;
  details?: Record<string, unknown>;
};

// Renvoie true si la ligne de journal est bien enregistrée.
// Les appelants existants peuvent ignorer le résultat : un échec du journal
// n'annule pas l'action déjà réussie, mais il se voit dans les logs du serveur.
// Une action sensible (afficher un mot de passe) vérifie le résultat AVANT d'agir.
export async function logActivity(
  admin: SupabaseClient,
  e: Entry,
): Promise<boolean> {
  const { error } = await admin.from("activity_log").insert({
    agency_id: e.agencyId,
    actor_id: e.actorId,
    action: e.action,
    target_type: e.targetType ?? null,
    target_id: e.targetId ?? null,
    case_id: e.caseId ?? null,
    details: e.details ?? {},
  });
  if (error) {
    console.error("[activity_log]", error.code);
    return false;
  }
  return true;
}
