import { ok, parseBody, safely } from "@/lib/api-errors";
import { caseStatusSchema } from "@/features/cases/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { setCaseStatus } from "@/features/cases/server/cases";

// Clore, abandonner ou rouvrir un dossier (tout membre actif). En le
// fermant, on peut aussi marquer faites ses tâches à faire (même transaction).
export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("cases status", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { status, completeTasks } = await parseBody(request, caseStatusSchema);
    await setCaseStatus(auth, id, status, { completeTasks });
    return ok();
  });
}
