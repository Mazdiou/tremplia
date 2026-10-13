import { ok, parseBody, safely } from "@/lib/api-errors";
import { updateCaseSchema } from "@/features/cases/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { updateCase } from "@/features/cases/server/cases";

// Modifier un dossier (tout membre actif ; le responsable, patron seulement)
export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("cases update", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, updateCaseSchema);
    const changed = await updateCase(auth, id, input);
    return ok({ ok: true, changed });
  });
}
