import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { noteSchema } from "@/features/notes/schemas";
import { deleteNote, updateNote } from "@/features/notes/server/notes";

type Ctx = { params: Promise<{ id: string; noteId: string }> };

// Modifier ou supprimer une note : son auteur, ou un patron
export function PATCH(request: Request, { params }: Ctx) {
  return safely("notes update", async () => {
    const { id, noteId } = await params;
    const auth = await authorizeCase(id);
    const { content } = await parseBody(request, noteSchema);
    await updateNote(auth, id, parseId(noteId), content);
    return ok();
  });
}

export function DELETE(_request: Request, { params }: Ctx) {
  return safely("notes delete", async () => {
    const { id, noteId } = await params;
    const auth = await authorizeCase(id);
    await deleteNote(auth, id, parseId(noteId));
    return ok();
  });
}
