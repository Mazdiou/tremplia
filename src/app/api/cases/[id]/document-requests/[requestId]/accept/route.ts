import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { acceptRequestSchema } from "@/features/document-requests/schemas";
import { setRequestAccepted } from "@/features/document-requests/server/requests";

// Accepter la pièce reçue, ou revenir dessus (tout membre actif)
export function PUT(request: Request, { params }: { params: Promise<{ id: string; requestId: string }> }) {
  return safely("document requests accept", async () => {
    const { id, requestId } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, acceptRequestSchema);
    await setRequestAccepted(auth, id, parseId(requestId), input);
    return ok();
  });
}
