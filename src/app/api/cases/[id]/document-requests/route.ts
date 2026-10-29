import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { documentRequestSchema } from "@/features/document-requests/schemas";
import { createRequest } from "@/features/document-requests/server/requests";

// Demander une pièce au candidat (tout membre actif)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("document requests create", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, documentRequestSchema);
    return ok({ id: await createRequest(auth, id, input) }, 201);
  });
}
