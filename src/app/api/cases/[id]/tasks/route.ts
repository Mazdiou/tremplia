import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { taskSchema } from "@/features/tasks/schemas";
import { createTask } from "@/features/tasks/server/tasks";

// Ajouter une tâche (tout membre actif)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("tasks create", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, taskSchema);
    return ok({ id: await createTask(auth, id, input) }, 201);
  });
}
