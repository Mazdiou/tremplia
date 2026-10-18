import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { taskSchema } from "@/features/tasks/schemas";
import { deleteTask, updateTask } from "@/features/tasks/server/tasks";

type Ctx = { params: Promise<{ id: string; taskId: string }> };

// Modifier une tâche : son auteur, son responsable, ou un patron
export function PATCH(request: Request, { params }: Ctx) {
  return safely("tasks update", async () => {
    const { id, taskId } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, taskSchema);
    await updateTask(auth, id, parseId(taskId), input);
    return ok();
  });
}

// Supprimer une tâche : son auteur, ou un patron
export function DELETE(_request: Request, { params }: Ctx) {
  return safely("tasks delete", async () => {
    const { id, taskId } = await params;
    const auth = await authorizeCase(id);
    await deleteTask(auth, id, parseId(taskId));
    return ok();
  });
}
