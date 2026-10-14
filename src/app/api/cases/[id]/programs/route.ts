import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { programSchema } from "@/features/programs/schemas";
import { createProgram } from "@/features/programs/server/programs";

// Ajouter une formation en fin de liste (tout membre actif)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("programs create", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, programSchema);
    return ok({ id: await createProgram(auth, id, input) }, 201);
  });
}
