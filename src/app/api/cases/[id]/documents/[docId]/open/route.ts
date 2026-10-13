import { z } from "zod";
import { DOCUMENTS_BUCKET } from "@/features/documents/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { fail, ok } from "@/lib/api-errors";

// Lien signé valable une minute, jamais mis en cache.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;
    if (!z.string().uuid().safeParse(docId).success) {
      return fail("Identifiant invalide", 400);
    }

    const { data: doc, error: readError } = await auth.admin
      .from("documents")
      .select("storage_path")
      .eq("id", docId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (readError) {
      console.error("[documents open] lecture", readError.message);
      return fail("Erreur serveur", 500);
    }
    if (!doc) return fail("Document introuvable", 404);

    const { data, error } = await auth.admin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      console.error("[documents open]", error?.message);
      return fail("Impossible d'ouvrir le document", 500);
    }

    return ok({ url: data.signedUrl });
  } catch (e) {
    console.error("[documents open]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
