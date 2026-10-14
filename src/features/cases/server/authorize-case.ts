import "server-only";
import { ApiError, dbError, parseId } from "@/lib/api-errors";
import { logActivity, type ActivityEntry } from "@/lib/audit/log-activity";
import { requireApiMember } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";

// Vérifie l'appelant, l'identifiant et que le dossier est bien celui de son
// agence. La clé secrète contourne le RLS : tout filtre sur agency_id vient
// de la session, jamais de la requête.
export async function authorizeCase(caseId: string) {
  const member = await requireApiMember();
  parseId(caseId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("agency_id", member.agencyId)
    .maybeSingle();

  if (error) throw dbError("authorize case", error);
  if (!data) throw new ApiError(404, "Dossier introuvable");
  return { member, admin, agencyId: member.agencyId };
}

export type AuthorizedCase = Awaited<ReturnType<typeof authorizeCase>>;

// Inscrit au journal une action de l'appelant sur ce dossier. Renvoie false
// si la ligne n'a pas pu être écrite (voir logActivity).
export function logCaseActivity(
  auth: AuthorizedCase,
  caseId: string,
  entry: Pick<ActivityEntry, "action" | "targetType" | "targetId" | "details">,
) {
  return logActivity(auth.admin, {
    agencyId: auth.agencyId,
    actorId: auth.member.userId,
    caseId,
    ...entry,
  });
}
