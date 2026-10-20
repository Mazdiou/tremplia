import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { employeePermissionsSchema } from "@/features/team/schemas";
import { setEmployeePermissions } from "@/features/team/server/team";

// Permissions d'un employé de confiance : patron seulement
export function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("team permissions", async () => {
    const owner = await requireApiOwner();
    const id = parseId((await params).id);
    const { permissions } = await parseBody(request, employeePermissionsSchema);
    await setEmployeePermissions(owner, id, permissions);
    return ok();
  });
}
