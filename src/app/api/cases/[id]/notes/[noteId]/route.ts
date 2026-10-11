import { z } from "zod";
import { noteContentSchema } from "@/lib/notes";
import {
  authorizeCase,
  fail,
  ok,
  readJson,
  validationError,
} from "@/lib/documents-api";
import { logActivity } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string; noteId: string }> };

// Modifier ou supprimer : l'auteur de la note, ou un patron. La règle est
// appliquée par les fonctions SQL update_case_note et delete_case_note ;
// les routes ne font que vérifier que la note appartient bien à ce dossier.
async function noteInCase(
  auth: Extract<Awaited<ReturnType<typeof authorizeCase>>, { ok: true }>,
  caseId: string,
  noteId: string,
) {
  const { data, error } = await auth.admin
    .from("case_notes")
    .select("id")
    .eq("id", noteId)
    .eq("case_id", caseId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  return { found: !!data, error };
}

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id, noteId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;
    if (!z.string().uuid().safeParse(noteId).success) {
      return fail("Identifiant invalide", 400);
    }

    const body = await readJson(request);
    if (body === null) return fail("Requête invalide", 400);
    const parsed = z.object({ content: noteContentSchema }).safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const check = await noteInCase(auth, id, noteId);
    if (check.error) {
      console.error("[notes update] lecture", check.error.code);
      return fail("Erreur serveur", 500);
    }
    if (!check.found) return fail("Note introuvable", 404);

    const { error } = await auth.admin.rpc("update_case_note", {
      p_note_id: noteId,
      p_agency_id: auth.agencyId,
      p_actor_id: auth.caller.user.id,
      p_content: parsed.data.content,
    });
    if (error) {
      if (error.code === "42501") {
        return fail("Vous ne pouvez modifier que vos propres notes", 403);
      }
      if (error.code === "P0002") return fail("Note introuvable", 404);
      if (error.code === "23514") return fail("Note invalide", 400);
      console.error("[notes update]", error.code);
      return fail("Impossible de modifier la note", 500);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "note.updated",
      targetType: "case_note",
      targetId: noteId,
      caseId: id,
    });

    return ok();
  } catch (e) {
    console.error("[notes update]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, noteId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;
    if (!z.string().uuid().safeParse(noteId).success) {
      return fail("Identifiant invalide", 400);
    }

    const check = await noteInCase(auth, id, noteId);
    if (check.error) {
      console.error("[notes delete] lecture", check.error.code);
      return fail("Erreur serveur", 500);
    }
    if (!check.found) return fail("Note introuvable", 404);

    const { error } = await auth.admin.rpc("delete_case_note", {
      p_note_id: noteId,
      p_agency_id: auth.agencyId,
      p_actor_id: auth.caller.user.id,
    });
    if (error) {
      if (error.code === "42501") {
        return fail("Vous ne pouvez supprimer que vos propres notes", 403);
      }
      if (error.code === "P0002") return fail("Note introuvable", 404);
      console.error("[notes delete]", error.code);
      return fail("Impossible de supprimer la note", 500);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "note.deleted",
      targetType: "case_note",
      targetId: noteId,
      caseId: id,
    });

    return ok();
  } catch (e) {
    console.error("[notes delete]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
