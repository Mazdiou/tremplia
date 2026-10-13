import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { createCampaignSchema } from "@/features/campaigns/schemas";
import { createCampaign } from "@/features/campaigns/server/campaigns";

// Créer une campagne avec ses dates, informations et groupes : patron seulement
export function POST(request: Request) {
  return safely("campaigns create", async () => {
    const member = await requireApiOwner();
    const input = await parseBody(request, createCampaignSchema);
    const id = await createCampaign(member, input);
    return ok({ id }, 201);
  });
}
