import { parseId, safely } from "@/lib/api-errors";
import { requireApiPermission } from "@/lib/auth/require-member";
import { exportCampaign } from "@/features/export/server/campaign-export";

// Classeur Excel d'une campagne : patron ou permission « Gérer les campagnes »
export function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("campaigns export", async () => {
    const member = await requireApiPermission("campaigns_manage");
    const { fileName, workbook } = await exportCampaign(member, parseId((await params).id));
    // Nom de repli sans accent pour les navigateurs qui ignorent filename*
    const ascii = fileName
      .normalize("NFD")
      .replace(/[^\x20-\x7E]|"/g, "")
      .replace(/\s+/g, " ");
    return new Response(workbook as Uint8Array<ArrayBuffer>, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  });
}
