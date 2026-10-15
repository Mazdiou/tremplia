import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { platformPaymentSchema } from "@/features/admin/schemas";
import {
  recordPlatformPayment,
  requireApiPlatformAdmin,
} from "@/features/admin/server/admin";

// « Paiement reçu » : allonge l'abonnement d'une agence (administrateur seulement)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("admin payment", async () => {
    const admin = await requireApiPlatformAdmin();
    const agencyId = parseId((await params).id);
    const input = await parseBody(request, platformPaymentSchema);
    const endsAt = await recordPlatformPayment(admin.userId, agencyId, input);
    return ok({ ok: true, endsAt }, 201);
  });
}
