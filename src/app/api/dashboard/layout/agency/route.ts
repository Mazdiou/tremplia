import { ok, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { removeAgencyLayout } from "@/features/dashboard/server/layout";

// Patron : retire la disposition du tableau de bord proposée à l'équipe
export function DELETE() {
  return safely("dashboard layout agency", async () => {
    const owner = await requireApiOwner();
    await removeAgencyLayout(owner);
    return ok();
  });
}
