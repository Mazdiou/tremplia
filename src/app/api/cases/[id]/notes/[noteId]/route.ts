import { z } from "zod";
import { ApiError, dbError, ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { authorizeCase, type AuthorizedCase } from "@/features/cases/server/authorize-case";
import { noteContentSchema } from "@/features/notes/schemas";

type Ctx = { params: Promise<{ id: string; noteId: string }> };

// Modifier ou supprimer : l'auteur de la note, ou un patron. La règle est
// appliquée par les fonctions SQL update_case_note et delete_case_note ;
// les routes vérifient seulement que la note appartient bien à ce dossier.
async function assertNoteInCase(auth: AuthorizedCase, caseId: string, noteId: string) {
  parseId(noteId);
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

export function PATCH(request: Request, { params }: Ctx) {
  return safely("notes update", async () => {
    const { id, noteId } = await params;
    const auth = await authorizeCase(id);
    const { content } = await parseBody(request, z.object({ content: noteContentSchema }));
    await assertNoteInCase(auth, id, noteId);

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

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "note.updated",
      targetType: "case_note",
      targetId: noteId,
      caseId: id,
    });
    return ok();
  });
}

export function DELETE(_request: Request, { params }: Ctx) {
  return safely("notes delete", async () => {
    const { id, noteId } = await params;
    const auth = await authorizeCase(id);
    await assertNoteInCase(auth, id, noteId);

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

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "note.deleted",
      targetType: "case_note",
      targetId: noteId,
      caseId: id,
    });
    return ok();
  });
}
