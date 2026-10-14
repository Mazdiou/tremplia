import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { folderSchema } from "@/features/documents/schemas";
import { createFolder } from "@/features/documents/server/folders";

// Créer un dossier de rangement pour les documents (tout membre actif)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("document folders create", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { name } = await parseBody(request, folderSchema);
    return ok({ id: await createFolder(auth, id, name) }, 201);
  });
}
