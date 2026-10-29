import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { folderSchema } from "@/features/documents/schemas";
import { deleteFolder, renameFolder } from "@/features/documents/server/folders";

type Ctx = { params: Promise<{ id: string; folderId: string }> };

// Renommer un dossier de documents (tout membre actif)
export function PATCH(request: Request, { params }: Ctx) {
  return safely("document folders rename", async () => {
    const { id, folderId } = await params;
    const auth = await authorizeCase(id);
    const { name } = await parseBody(request, folderSchema);
    await renameFolder(auth, id, parseId(folderId), name);
    return ok();
  });
}

// Supprimer un dossier de documents (patron seulement) : ses documents
// passent dans « Sans catégorie »
export function DELETE(_request: Request, { params }: Ctx) {
  return safely("document folders delete", async () => {
    const { id, folderId } = await params;
    const auth = await authorizeCase(id);
    await deleteFolder(auth, id, parseId(folderId));
    return ok();
  });
}
