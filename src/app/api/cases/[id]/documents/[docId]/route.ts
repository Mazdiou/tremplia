import { z } from "zod";
import { DOCUMENTS_BUCKET, documentNameSchema } from "@/features/documents/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { fail, ok, readJson, validationError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";

type Ctx = { params: Promise<{ id: string; docId: string }> };

// 55006 : le trigger de la base refuse de toucher un document verrouillé
const LOCKED = "55006";

export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;
    if (!z.string().uuid().safeParse(docId).success) {
      return fail("Identifiant invalide", 400);
    }

    const body = await readJson(request);
    if (body === null) return fail("Requête invalide", 400);
    const parsed = z.object({ name: documentNameSchema }).safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { name } = parsed.data;

    const { data, error } = await auth.admin
      .from("documents")
      .update({ name })
      .eq("id", docId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === LOCKED) {
        return fail(
          "Ce document est verrouillé par le patron : il ne peut plus être renommé",
          409,
        );
      }
      console.error("[documents rename]", error.message);
      return fail("Impossible de renommer le document", 500);
    }
    if (!data) return fail("Document introuvable", 404);

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "document.renamed",
      targetType: "document",
      targetId: docId,
      caseId: id,
      details: { name },
    });

    return ok();
  } catch (e) {
    console.error("[documents rename]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;
    if (!z.string().uuid().safeParse(docId).success) {
      return fail("Identifiant invalide", 400);
    }

    const { data: doc, error: readError } = await auth.admin
      .from("documents")
      .select("id, name, storage_path")
      .eq("id", docId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (readError) {
      console.error("[documents delete] lecture", readError.message);
      return fail("Erreur serveur", 500);
    }
    if (!doc) return fail("Document introuvable", 404);

    // La ligne d'abord : si le document est verrouillé, la base refuse et le
    // fichier n'est pas touché.
    const { error } = await auth.admin
      .from("documents")
      .delete()
      .eq("id", docId)
      .eq("agency_id", auth.agencyId);
    if (error) {
      if (error.code === LOCKED) {
        return fail(
          "Ce document est verrouillé par le patron : il ne peut plus être supprimé",
          409,
        );
      }
      console.error("[documents delete]", error.message);
      return fail("Impossible de supprimer le document", 500);
    }

    const { error: removeError } = await auth.admin.storage
      .from(DOCUMENTS_BUCKET)
      .remove([doc.storage_path]);
    if (removeError) {
      // La ligne est supprimée : le fichier restant est orphelin et inaccessible
      console.error("[documents delete] fichier", removeError.message);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "document.deleted",
      targetType: "document",
      targetId: docId,
      caseId: id,
      details: { name: doc.name },
    });

    return ok();
  } catch (e) {
    console.error("[documents delete]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
