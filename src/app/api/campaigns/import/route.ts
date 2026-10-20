import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiPermission } from "@/lib/auth/require-member";
import { importCampaignSchema } from "@/features/campaigns/schemas";
import { importCampaignTemplate } from "@/features/campaigns/server/campaigns";

// Importer un modèle de campagne (copie modifiable) : patron ou permission « Gérer les campagnes »
export function POST(request: Request) {
  return safely("campaigns import", async () => {
    const member = await requireApiPermission("campaigns_manage");
    const { templateKey } = await parseBody(request, importCampaignSchema);
    const id = await importCampaignTemplate(member, templateKey);
    return ok({ id }, 201);
  });
}
