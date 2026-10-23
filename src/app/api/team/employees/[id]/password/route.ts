import { ok, parseId, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { resetEmployeePassword } from "@/features/team/server/team";

// Nouveau mot de passe temporaire pour un employé : patron seulement
export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("team password", async () => {
    const owner = await requireApiOwner();
    const id = parseId((await params).id);
    const temporaryPassword = await resetEmployeePassword(owner, id);
    return ok({ temporaryPassword });
  });
}
