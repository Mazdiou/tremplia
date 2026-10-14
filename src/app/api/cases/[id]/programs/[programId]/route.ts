import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { programSchema } from "@/features/programs/schemas";
import { deleteProgram, updateProgram } from "@/features/programs/server/programs";

type Ctx = { params: Promise<{ id: string; programId: string }> };

// Modifier ou supprimer une formation (tout membre actif)
export function PATCH(request: Request, { params }: Ctx) {
  return safely("programs update", async () => {
    const { id, programId } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, programSchema);
    await updateProgram(auth, id, parseId(programId), input);
    return ok();
  });
}

export function DELETE(_request: Request, { params }: Ctx) {
  return safely("programs delete", async () => {
    const { id, programId } = await params;
    const auth = await authorizeCase(id);
    await deleteProgram(auth, id, parseId(programId));
    return ok();
  });
}
