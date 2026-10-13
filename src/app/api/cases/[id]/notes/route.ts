import { z } from "zod";
import { noteContentSchema } from "@/features/notes/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { fail, ok, readJson, validationError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";

// Ajouter une note (tout membre actif). Le contenu n'est jamais écrit dans
// le journal ni dans les logs du serveur.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;

    const body = await readJson(request);
    if (body === null) return fail("Requête invalide", 400);
    const parsed = z.object({ content: noteContentSchema }).safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const { data, error } = await auth.admin.rpc("create_case_note", {
      p_case_id: id,
      p_agency_id: auth.agencyId,
      p_actor_id: auth.caller.user.id,
      p_content: parsed.data.content,
    });
    if (error || typeof data !== "string") {
      if (error?.code === "42501") return fail("Accès refusé", 403);
      if (error?.code === "P0002") return fail("Dossier introuvable", 404);
      if (error?.code === "23514") return fail("Note invalide", 400);
      console.error("[notes create]", error?.code ?? "résultat inattendu");
      return fail("Impossible d'ajouter la note", 500);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "note.created",
      targetType: "case_note",
      targetId: data,
      caseId: id,
    });

    return ok({ id: data }, 201);
  } catch (e) {
    console.error("[notes create]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
