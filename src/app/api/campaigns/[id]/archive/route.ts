import { ok, parseId, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { setCampaignArchived } from "@/features/campaigns/server/campaigns";

export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("campaigns archive", async () => {
    const member = await requireApiOwner();
    await setCampaignArchived(member, parseId((await params).id), true);
    return ok();
  });
}
