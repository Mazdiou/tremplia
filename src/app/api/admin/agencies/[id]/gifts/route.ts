import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { giftMonthsSchema } from "@/features/admin/schemas";
import { recordGiftMonths, requireApiPlatformAdmin } from "@/features/admin/server/admin";

// « Offrir des mois » : allonge l'abonnement sans paiement (administrateur seulement)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("admin gift", async () => {
    const admin = await requireApiPlatformAdmin();
    const agencyId = parseId((await params).id);
    const input = await parseBody(request, giftMonthsSchema);
    const endsAt = await recordGiftMonths(admin.userId, agencyId, input);
    return ok({ ok: true, endsAt }, 201);
  });
}
