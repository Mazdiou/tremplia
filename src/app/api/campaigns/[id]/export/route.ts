import { parseId, safely } from "@/lib/api-errors";
import { requireApiPermission } from "@/lib/auth/require-member";
import { xlsxDownload } from "@/lib/xlsx";
import { exportCampaign } from "@/features/export/server/campaign-export";

// Classeur Excel d'une campagne : patron ou permission « Gérer les campagnes »
export function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("campaigns export", async () => {
    const member = await requireApiPermission("campaigns_manage");
    const { fileName, workbook } = await exportCampaign(member, parseId((await params).id));
    return xlsxDownload(workbook, fileName);
  });
}
