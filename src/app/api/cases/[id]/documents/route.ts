import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { addDocumentSchema } from "@/features/documents/schemas";
import { addDocument } from "@/features/documents/server/documents";

// Étape 2 de l'envoi : vérifier le fichier reçu et créer le document
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("documents add", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, addDocumentSchema);
    await addDocument(auth, id, input);
    return ok({ id: input.documentId }, 201);
  });
}
