import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { replaceStagesSchema } from "@/features/stages/schemas";
import { replaceCampaignStages } from "@/features/stages/server/stages";

// Remplacer la liste des étapes d'une campagne : patron seulement
export function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("stages replace", async () => {
    const member = await requireApiOwner();
    const id = parseId((await params).id);
    const { stages } = await parseBody(request, replaceStagesSchema);
    const moved = await replaceCampaignStages(member, id, stages);
    return ok({ moved });
  });
}
