import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { campaignDefaultsSchema } from "@/features/settings/schemas";
import { updateCampaignDefaults } from "@/features/settings/server/settings";

// Valeurs proposées aux nouvelles campagnes : patron seulement
export function PATCH(request: Request) {
  return safely("settings defaults", async () => {
    const owner = await requireApiOwner();
    const input = await parseBody(request, campaignDefaultsSchema);
    await updateCampaignDefaults(owner, input);
    return ok();
  });
}
