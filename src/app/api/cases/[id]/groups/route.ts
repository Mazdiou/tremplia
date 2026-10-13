import { ok, parseBody, safely } from "@/lib/api-errors";
import { caseGroupsSchema } from "@/features/cases/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { setCaseGroups } from "@/features/cases/server/cases";

// Remplacer le classement du dossier dans les groupes de sa campagne
export function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("cases groups", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { groupIds } = await parseBody(request, caseGroupsSchema);
    await setCaseGroups(auth, id, groupIds);
    return ok();
  });
}
