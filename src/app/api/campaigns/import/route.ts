import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { importCampaignSchema } from "@/features/campaigns/schemas";
import { importCampaignTemplate } from "@/features/campaigns/server/campaigns";

// Importer un modèle de campagne (copie modifiable) : patron seulement
export function POST(request: Request) {
  return safely("campaigns import", async () => {
    const member = await requireApiOwner();
    const { templateKey } = await parseBody(request, importCampaignSchema);
    const id = await importCampaignTemplate(member, templateKey);
    return ok({ id }, 201);
  });
}
