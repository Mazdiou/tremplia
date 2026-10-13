import "server-only";
import { ApiError, dbError, parseId } from "@/lib/api-errors";
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
