import { z } from "zod";
import { ApiError, dbError, ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { authorizeCase } from "@/features/cases/server/authorize-case";

// Verrouiller / déverrouiller : patron seulement. La fonction SQL
// set_document_lock revérifie le rôle côté base.
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  return safely("documents lock", async () => {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.member.isOwner) {
      throw new ApiError(403, "Seul le patron peut verrouiller un document");
    }
    parseId(docId);
    const { locked } = await parseBody(request, z.object({ locked: z.boolean() }));

    const { data: doc, error: readError } = await auth.admin
      .from("documents")
      .select("id")
      .eq("id", docId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (readError) throw dbError("documents lock read", readError);
    if (!doc) throw new ApiError(404, "Document introuvable");

    const { error } = await auth.admin.rpc("set_document_lock", {
      p_document_id: docId,
      p_agency_id: auth.agencyId,
      p_actor_id: auth.member.userId,
      p_locked: locked,
    });
    if (error) throw dbError("documents lock", error, { P0002: "Document introuvable" });

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: locked ? "document.locked" : "document.unlocked",
      targetType: "document",
      targetId: docId,
      caseId: id,
    });
    return ok();
  });
}
