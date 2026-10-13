import { z } from "zod";
import { ApiError, dbError, ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { DOCUMENTS_BUCKET, documentNameSchema } from "@/features/documents/schemas";

type Ctx = { params: Promise<{ id: string; docId: string }> };

// Renommer un document (tout membre actif). La base refuse un document
// verrouillé par le patron (55006).
export function PATCH(request: Request, { params }: Ctx) {
  return safely("documents rename", async () => {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    parseId(docId);
    const { name } = await parseBody(request, z.object({ name: documentNameSchema }));

    const { data, error } = await auth.admin
      .from("documents")
      .update({ name })
      .eq("id", docId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .select("id")
      .maybeSingle();
    if (error) {
      throw dbError("documents rename", error, {
        "55006": "Ce document est verrouillé par le patron : il ne peut plus être renommé",
      });
    }
    if (!data) throw new ApiError(404, "Document introuvable");

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "document.renamed",
      targetType: "document",
      targetId: docId,
      caseId: id,
    });
    return ok();
  });
}

// Supprimer un document (tout membre actif), sauf s'il est verrouillé
export function DELETE(_request: Request, { params }: Ctx) {
  return safely("documents delete", async () => {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    parseId(docId);

    const { data: doc, error: readError } = await auth.admin
      .from("documents")
      .select("storage_path")
      .eq("id", docId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (readError) throw dbError("documents delete read", readError);
    if (!doc) throw new ApiError(404, "Document introuvable");

    // La ligne d'abord : si le document est verrouillé, la base refuse et le
    // fichier n'est pas touché.
    const { error } = await auth.admin
      .from("documents")
      .delete()
      .eq("id", docId)
      .eq("agency_id", auth.agencyId);
    if (error) {
      throw dbError("documents delete", error, {
        "55006": "Ce document est verrouillé par le patron : il ne peut plus être supprimé",
      });
    }

    const { error: removeError } = await auth.admin.storage
      .from(DOCUMENTS_BUCKET)
      .remove([doc.storage_path as string]);
    if (removeError) {
      // La ligne est supprimée : le fichier restant est orphelin et inaccessible
      console.error("[documents delete] fichier", removeError.name);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "document.deleted",
      targetType: "document",
      targetId: docId,
      caseId: id,
    });
    return ok();
  });
}
