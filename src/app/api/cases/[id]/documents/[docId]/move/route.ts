import { z } from "zod";
import { ApiError, dbError, ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { authorizeCase } from "@/features/cases/server/authorize-case";

// Déplacer un document vers un dossier (folderId) ou vers « Sans dossier »
// (folderId = null). Tout membre actif ; un document verrouillé ne bouge pas
// (le trigger de la base refuse, code 55006).
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  return safely("documents move", async () => {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    parseId(docId);
    const { folderId } = await parseBody(
      request,
      z.object({ folderId: z.string().uuid().nullable() }),
    );

    const { data: doc, error: readError } = await auth.admin
      .from("documents")
      .select("folder_id")
      .eq("id", docId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (readError) throw dbError("documents move read", readError);
    if (!doc) throw new ApiError(404, "Document introuvable");
    if (doc.folder_id === folderId) return ok();

    // La clé composite refuse un dossier qui n'est pas de ce candidat (23503)
    const { error } = await auth.admin
      .from("documents")
      .update({ folder_id: folderId })
      .eq("id", docId)
      .eq("agency_id", auth.agencyId);
    if (error) {
      throw dbError("documents move", error, {
        "55006": "Ce document est verrouillé par le patron : il ne peut plus être déplacé",
        "23503": "Dossier introuvable",
      });
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "document.moved",
      targetType: "document",
      targetId: docId,
      caseId: id,
      details: { from_folder_id: (doc.folder_id as string | null) ?? null, to_folder_id: folderId },
    });
    return ok();
  });
}
