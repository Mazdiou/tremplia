import { ApiError, dbError, ok, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { DOCUMENTS_BUCKET } from "@/features/documents/schemas";

// Lien signé valable une minute, jamais mis en cache.
export function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  return safely("documents open", async () => {
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
    if (readError) throw dbError("documents open read", readError);
    if (!doc) throw new ApiError(404, "Document introuvable");

    const { data, error } = await auth.admin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path as string, 60);
    if (error || !data) {
      console.error("[documents open]", error?.name ?? "erreur");
      throw new ApiError(500, "Impossible d'ouvrir le document");
    }

    return ok({ url: data.signedUrl });
  });
}
