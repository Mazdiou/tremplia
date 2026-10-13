import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityAction, ActivityTarget } from "./actions";

// `details` : jamais de donnée personnelle ni de secret, seulement des
// identifiants, des noms de champs, des statuts et des nombres.
type Detail = string | number | boolean | null | string[];

type Entry = {
  agencyId: string;
  actorId: string | null;
  action: ActivityAction;
  targetType?: ActivityTarget;
  targetId?: string;
  caseId?: string;
  details?: Record<string, Detail>;
};

// Renvoie true si la ligne de journal est bien enregistrée.
// Un échec du journal n'annule pas une action déjà réussie (il se voit dans
// les logs du serveur). Une action sensible (afficher un mot de passe)
// vérifie le résultat AVANT d'agir.
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
