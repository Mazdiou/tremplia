import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { moveDocumentSchema } from "@/features/documents/schemas";
import { moveDocument } from "@/features/documents/server/documents";

// Déplacer un document vers un dossier, ou vers « Sans dossier » (folderId
// null). Tout membre actif ; un document verrouillé ne bouge pas.
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  return safely("documents move", async () => {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    const { folderId } = await parseBody(request, moveDocumentSchema);
    await moveDocument(auth, id, parseId(docId), folderId);
    return ok();
  });
}
