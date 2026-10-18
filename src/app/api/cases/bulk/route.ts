import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { bulkCasesSchema } from "@/features/cases/schemas";
import { applyBulkAction } from "@/features/cases/server/bulk";

// Même étape ou même tâche (tout membre actif), ou même responsable (patron
// seulement) pour plusieurs dossiers d'un coup, tout ou rien
export function POST(request: Request) {
  return safely("cases bulk", async () => {
    const member = await requireApiMember();
    const input = await parseBody(request, bulkCasesSchema);
    return ok({ changed: await applyBulkAction(member, input) });
  });
}
