import { ApiError, ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { saveLayoutSchema } from "@/features/dashboard/widgets";
import { saveDashboardLayout } from "@/features/dashboard/server/layout";

// Disposition du tableau de bord du membre connecté ; le patron peut en faire
// aussi celle de l'agence
export function PUT(request: Request) {
  return safely("dashboard layout", async () => {
    const member = await requireApiMember();
    const { layout, forAgency } = await parseBody(request, saveLayoutSchema);
    if (forAgency && !member.isOwner) throw new ApiError(403, "Réservé au patron");
    await saveDashboardLayout(member, layout, forAgency === true);
    return ok();
  });
}
