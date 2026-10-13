import { z } from "zod";
import { ApiError, dbError, ok, parseBody, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { noteContentSchema } from "@/features/notes/schemas";

// Ajouter une note (tout membre actif). Le contenu n'est jamais écrit dans
// le journal ni dans les logs du serveur.
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("notes create", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { content } = await parseBody(request, z.object({ content: noteContentSchema }));

    const { data, error } = await auth.admin.rpc("create_case_note", {
      p_case_id: id,
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

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "note.created",
      targetType: "case_note",
      targetId: data,
      caseId: id,
    });
    return ok({ id: data }, 201);
  });
}
