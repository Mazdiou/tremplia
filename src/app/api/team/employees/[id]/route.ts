import { ok, parseId, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { deleteEmployee } from "@/features/team/server/team";

// Supprimer un employé désactivé et sans historique : patron seulement
export function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("team delete", async () => {
    const owner = await requireApiOwner();
    await deleteEmployee(owner, parseId((await params).id));
    return ok();
  });
}
