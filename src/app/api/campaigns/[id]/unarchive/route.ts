import { ok, parseId, safely } from "@/lib/api-errors";
import { requireApiPermission } from "@/lib/auth/require-member";
import { setCampaignArchived } from "@/features/campaigns/server/campaigns";

export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("campaigns unarchive", async () => {
    const member = await requireApiPermission("campaigns_manage");
    await setCampaignArchived(member, parseId((await params).id), false);
    return ok();
  });
}
