import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { groupSchema } from "@/features/campaigns/schemas";
import { createGroup } from "@/features/campaigns/server/campaigns";

// Créer un groupe dans une campagne : tout membre actif
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("groups create", async () => {
    const member = await requireApiMember();
    const campaignId = parseId((await params).id);
    const { name } = await parseBody(request, groupSchema);
    const id = await createGroup(member, campaignId, name);
    return ok({ id }, 201);
  });
}
