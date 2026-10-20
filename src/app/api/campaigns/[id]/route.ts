import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { requireApiPermission } from "@/lib/auth/require-member";
import { campaignSettingsSchema } from "@/features/campaigns/schemas";
import { deleteCampaign, updateCampaign } from "@/features/campaigns/server/campaigns";

type Ctx = { params: Promise<{ id: string }> };

// Modifier le nom, les dates, les informations et les plateformes suggérées
export function PATCH(request: Request, { params }: Ctx) {
  return safely("campaigns update", async () => {
    const member = await requireApiPermission("campaigns_manage");
    const id = parseId((await params).id);
    const input = await parseBody(request, campaignSettingsSchema);
    await updateCampaign(member, id, input);
    return ok();
  });
}

// Supprimer une campagne vide (sinon : l'archiver)
export function DELETE(_request: Request, { params }: Ctx) {
  return safely("campaigns delete", async () => {
    const member = await requireApiPermission("campaigns_manage");
    const id = parseId((await params).id);
    await deleteCampaign(member, id);
    return ok();
  });
}
