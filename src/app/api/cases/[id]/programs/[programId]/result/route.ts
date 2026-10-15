import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { programResultSchema } from "@/features/programs/schemas";
import { setProgramResult } from "@/features/programs/server/programs";

type Ctx = { params: Promise<{ id: string; programId: string }> };

// Noter la réponse de l'établissement (tout membre actif)
export function PUT(request: Request, { params }: Ctx) {
  return safely("programs result", async () => {
    const { id, programId } = await params;
    const auth = await authorizeCase(id);
    const { result } = await parseBody(request, programResultSchema);
    await setProgramResult(auth, id, parseId(programId), result);
    return ok();
  });
}
