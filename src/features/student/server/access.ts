import "server-only";
import { dbError } from "@/lib/api-errors";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import { formatCode, generateCode } from "@/features/student/code";
import type { StudentAccess } from "@/features/student/schemas";
import { codeAad, codeLookup } from "./keys";
import { reportError } from "@/lib/report-error";

// Accès du candidat, côté agence : tout membre actif l'ouvre, le ferme ou
// change le code (revérifié par les fonctions SQL). Le code n'est jamais
// écrit dans le journal ni dans les logs.

// Code affiché à l'agence (null : jamais activé). La table n'est lisible
// qu'avec la clé secrète : filtre sur l'agence de la session.
export async function getStudentAccess(agencyId: string, caseId: string): Promise<StudentAccess> {
  const { data, error } = await createAdminClient()
    .from("case_student_access")
    .select("enabled, code_encrypted")
    .eq("case_id", caseId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (error) {
    reportError("[student access read]", error.code);
    return null;
  }
  if (!data) return null;
  try {
    const code = decryptSecret(data.code_encrypted as string, codeAad(agencyId, caseId));
    return { enabled: data.enabled as boolean, code: formatCode(code) };
  } catch {
    reportError("[student access read]", "déchiffrement");
    return null;
  }
}

function newCode(auth: AuthorizedCase, caseId: string) {
  const code = generateCode();
  const encrypted = encryptSecret(code, codeAad(auth.agencyId, caseId));
  return {
    p_code_lookup: codeLookup(code),
    p_code_encrypted: encrypted.value,
    p_key_version: encrypted.keyVersion,
  };
}

type AccessAction = "enable" | "disable" | "regenerate";

export async function changeStudentAccess(
  auth: AuthorizedCase,
  caseId: string,
  action: AccessAction,
) {
  const who = {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
  };
  const { data, error } =
    action === "enable"
      ? await auth.admin.rpc("enable_student_access", { ...who, ...newCode(auth, caseId) })
      : action === "disable"
        ? await auth.admin.rpc("disable_student_access", who)
        : await auth.admin.rpc("regenerate_student_code", { ...who, ...newCode(auth, caseId) });
  if (error) {
    throw dbError("student access", error, {
      P0002: action === "regenerate" ? "Activez d'abord l'accès" : "Dossier introuvable",
      "23505": "Réessayez",
    });
  }

  // enable et disable renvoient faux si rien n'a changé
  if (action === "regenerate" || data === true) {
    await logCaseActivity(auth, caseId, {
      action: `student_access.${action === "enable" ? "enabled" : action === "disable" ? "disabled" : "regenerated"}`,
      targetType: "case",
      targetId: caseId,
    });
  }
}
