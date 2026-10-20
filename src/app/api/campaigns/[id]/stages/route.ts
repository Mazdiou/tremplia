import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { requireApiPermission } from "@/lib/auth/require-member";
import { replaceStagesSchema } from "@/features/stages/schemas";
import { replaceCampaignStages } from "@/features/stages/server/stages";

// Remplacer la liste des étapes d'une campagne : patron ou permission « Gérer les campagnes »
export function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("stages replace", async () => {
    const member = await requireApiPermission("campaigns_manage");
    const id = parseId((await params).id);
    const { stages } = await parseBody(request, replaceStagesSchema);
    const moved = await replaceCampaignStages(member, id, stages);
    return ok({ moved });
  });
}
