import { ok, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { documentOpenUrl } from "@/features/documents/server/documents";

// Lien signé valable une minute, jamais mis en cache.
export function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  return safely("documents open", async () => {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    return ok({ url: await documentOpenUrl(auth, id, parseId(docId)) });
  });
}
