import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { lockDocumentSchema } from "@/features/documents/schemas";
import { setDocumentLock } from "@/features/documents/server/documents";

// Verrouiller / déverrouiller : patron seulement
export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  return safely("documents lock", async () => {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    const { locked } = await parseBody(request, lockDocumentSchema);
    await setDocumentLock(auth, id, parseId(docId), locked);
    return ok();
  });
}
