import { ok, parseBody, safely } from "@/lib/api-errors";
import { caseStatusSchema } from "@/features/cases/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { setCaseStatus } from "@/features/cases/server/cases";
import { completeCaseTasks } from "@/features/tasks/server/tasks";

// Clore, abandonner ou rouvrir un dossier (tout membre actif). En le
// fermant, on peut aussi marquer faites ses tâches à faire.
export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("cases status", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { status, completeTasks } = await parseBody(request, caseStatusSchema);
    await setCaseStatus(auth, id, status);
    if (completeTasks && status !== "active") await completeCaseTasks(auth, id);
    return ok();
  });
}
