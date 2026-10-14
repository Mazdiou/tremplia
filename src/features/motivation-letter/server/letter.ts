import "server-only";
import { dbError } from "@/lib/api-errors";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";

// Lettre de motivation d'un dossier : une seule, écrite par tout membre actif
// (revérifié par save_motivation_letter). Le texte n'est jamais écrit dans
// le journal ni dans les logs du serveur.
export async function saveLetter(auth: AuthorizedCase, caseId: string, content: string) {
  const { data: changed, error } = await auth.admin.rpc("save_motivation_letter", {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_content: content,
  });
  if (error) {
    throw dbError("motivation letter save", error, {
      P0002: "Dossier introuvable",
      "23514": "Lettre trop longue",
    });
  }

  if (changed === true) {
    await logCaseActivity(auth, caseId, {
      action: "motivation_letter.saved",
      targetType: "motivation_letter",
      targetId: caseId,
      details: { length: content.length },
    });
  }
}
