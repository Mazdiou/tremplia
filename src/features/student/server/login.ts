import "server-only";
import { ApiError, dbError, rateLimited } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCode } from "@/features/student/code";
import { codeLookup, ipHash } from "./keys";
import { sessionCookie } from "./session";

const WRONG = "Code incorrect, ou accès pas encore ouvert par votre agence.";

// Vérifie le code et renvoie le cookie de session. Le message d'échec ne dit
// jamais si le code existe. Essais limités par adresse et pour tout le
// service (fonction SQL student_login).
export async function studentLogin(input: string, ip: string) {
  const code = normalizeCode(input);
  if (!code) throw new ApiError(400, WRONG);

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("student_login", {
    p_code_lookup: codeLookup(code),
    p_ip_hash: ipHash(ip),
  });
  if (error) {
    throw (
      rateLimited(error, "Trop de tentatives. Réessayez dans 15 minutes.") ??
      dbError("student login", error)
    );
  }
  const row = (data as { case_id: string; agency_id: string; generation: number }[] | null)?.[0];
  if (!row) throw new ApiError(401, WRONG);

  await logActivity(admin, {
    agencyId: row.agency_id,
    actorId: null,
    action: "student.logged_in",
    targetType: "case",
    targetId: row.case_id,
    caseId: row.case_id,
  });
  return sessionCookie(row.case_id, row.agency_id, row.generation);
}
