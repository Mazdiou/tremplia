import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { employeeStatusSchema } from "@/features/team/schemas";
import { setEmployeeActive } from "@/features/team/server/team";

// Désactiver / réactiver un employé : patron seulement, jamais lui-même
export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("team status", async () => {
    const owner = await requireApiOwner();
    const id = parseId((await params).id);
    const { isActive } = await parseBody(request, employeeStatusSchema);
    await setEmployeeActive(owner, id, isActive);
    return ok();
  });
}
