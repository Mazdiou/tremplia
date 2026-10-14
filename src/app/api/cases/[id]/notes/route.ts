import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { noteSchema } from "@/features/notes/schemas";
import { createNote } from "@/features/notes/server/notes";

// Ajouter une note (tout membre actif)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("notes create", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { content } = await parseBody(request, noteSchema);
    return ok({ id: await createNote(auth, id, content) }, 201);
  });
}
