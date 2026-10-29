import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { documentRequestSchema } from "@/features/document-requests/schemas";
import { deleteRequest, updateRequest } from "@/features/document-requests/server/requests";

type Ctx = { params: Promise<{ id: string; requestId: string }> };

// Renommer une pièce demandée ou changer son dossier de rangement (tout
// membre actif)
export function PATCH(request: Request, { params }: Ctx) {
  return safely("document requests update", async () => {
    const { id, requestId } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, documentRequestSchema);
    await updateRequest(auth, id, parseId(requestId), input);
    return ok();
  });
}

// Ne plus demander une pièce (tout membre actif) : le document reçu reste
export function DELETE(_request: Request, { params }: Ctx) {
  return safely("document requests delete", async () => {
    const { id, requestId } = await params;
    const auth = await authorizeCase(id);
    await deleteRequest(auth, id, parseId(requestId));
    return ok();
  });
}
