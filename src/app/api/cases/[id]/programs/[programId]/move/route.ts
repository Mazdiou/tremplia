import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { moveProgramSchema } from "@/features/programs/schemas";
import { moveProgram } from "@/features/programs/server/programs";

type Ctx = { params: Promise<{ id: string; programId: string }> };

// Monter ou descendre une formation d'un rang (tout membre actif)
export function POST(request: Request, { params }: Ctx) {
  return safely("programs move", async () => {
    const { id, programId } = await params;
    const auth = await authorizeCase(id);
    const { direction } = await parseBody(request, moveProgramSchema);
    await moveProgram(auth, id, parseId(programId), direction);
    return ok();
  });
}
