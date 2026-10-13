import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { groupSchema } from "@/features/campaigns/schemas";
import { deleteGroup, renameGroup } from "@/features/campaigns/server/campaigns";

type Ctx = { params: Promise<{ id: string; groupId: string }> };

// Renommer un groupe : tout membre actif
export function PATCH(request: Request, { params }: Ctx) {
  return safely("groups rename", async () => {
    const member = await requireApiMember();
    const { id, groupId } = await params;
    const { name } = await parseBody(request, groupSchema);
    await renameGroup(member, parseId(id), parseId(groupId), name);
    return ok();
  });
}

// Supprimer un groupe : ses dossiers passent dans « Non classés »
export function DELETE(_request: Request, { params }: Ctx) {
  return safely("groups delete", async () => {
    const member = await requireApiMember();
    const { id, groupId } = await params;
    await deleteGroup(member, parseId(id), parseId(groupId));
    return ok();
  });
}
