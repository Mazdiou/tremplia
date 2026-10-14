import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";

// Notes d'un dossier. Le contenu n'est jamais écrit dans le journal ni dans
// les logs du serveur. Modifier ou supprimer : l'auteur ou un patron, règle
// appliquée par les fonctions SQL update_case_note et delete_case_note.

// La note doit appartenir à ce dossier
async function assertNoteInCase(auth: AuthorizedCase, caseId: string, noteId: string) {
  const { data, error } = await auth.admin
    .from("case_notes")
    .select("id")
    .eq("id", noteId)
    .eq("case_id", caseId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (error) throw dbError("notes read", error);
  if (!data) throw new ApiError(404, "Note introuvable");
}

// Tout membre actif
export async function createNote(auth: AuthorizedCase, caseId: string, content: string) {
  const { data, error } = await auth.admin.rpc("create_case_note", {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_content: content,
  });
  if (error) {
    throw dbError("notes create", error, {
      P0002: "Dossier introuvable",
      "23514": "Note invalide",
    });
  }
  if (typeof data !== "string") throw new ApiError(500, "Impossible d'ajouter la note");

  await logCaseActivity(auth, caseId, {
    action: "note.created",
    targetType: "case_note",
    targetId: data,
  });
  return data;
}

export async function updateNote(
  auth: AuthorizedCase,
  caseId: string,
  noteId: string,
  content: string,
) {
  await assertNoteInCase(auth, caseId, noteId);
  const { error } = await auth.admin.rpc("update_case_note", {
    p_note_id: noteId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_content: content,
  });
  if (error) {
    throw dbError("notes update", error, {
      "42501": "Vous ne pouvez modifier que vos propres notes",
      P0002: "Note introuvable",
      "23514": "Note invalide",
    });
  }

  await logCaseActivity(auth, caseId, {
    action: "note.updated",
    targetType: "case_note",
    targetId: noteId,
  });
}

export async function deleteNote(auth: AuthorizedCase, caseId: string, noteId: string) {
  await assertNoteInCase(auth, caseId, noteId);
  const { error } = await auth.admin.rpc("delete_case_note", {
    p_note_id: noteId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
  });
  if (error) {
    throw dbError("notes delete", error, {
      "42501": "Vous ne pouvez supprimer que vos propres notes",
      P0002: "Note introuvable",
    });
  }

  await logCaseActivity(auth, caseId, {
    action: "note.deleted",
    targetType: "case_note",
    targetId: noteId,
  });
}
