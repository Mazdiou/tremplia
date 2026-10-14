import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { renameDocumentSchema } from "@/features/documents/schemas";
import { deleteDocument, renameDocument } from "@/features/documents/server/documents";

type Ctx = { params: Promise<{ id: string; docId: string }> };

// Renommer un document (tout membre actif), sauf s'il est verrouillé
export function PATCH(request: Request, { params }: Ctx) {
  return safely("documents rename", async () => {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    const { name } = await parseBody(request, renameDocumentSchema);
    await renameDocument(auth, id, parseId(docId), name);
    return ok();
  });
}

// Supprimer un document (tout membre actif), sauf s'il est verrouillé
export function DELETE(_request: Request, { params }: Ctx) {
  return safely("documents delete", async () => {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    await deleteDocument(auth, id, parseId(docId));
    return ok();
  });
}
