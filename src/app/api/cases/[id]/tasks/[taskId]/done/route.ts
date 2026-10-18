import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { taskDoneSchema } from "@/features/tasks/schemas";
import { setTaskDone } from "@/features/tasks/server/tasks";

// Cocher « faite » ou rouvrir : son auteur, son responsable, ou un patron
export function PUT(request: Request, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  return safely("tasks done", async () => {
    const { id, taskId } = await params;
    const auth = await authorizeCase(id);
    const { done } = await parseBody(request, taskDoneSchema);
    await setTaskDone(auth, id, parseId(taskId), done);
    return ok();
  });
}
