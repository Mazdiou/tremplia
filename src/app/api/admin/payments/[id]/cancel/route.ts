import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { cancelPlatformPaymentSchema } from "@/features/admin/schemas";
import {
  cancelPlatformPayment,
  requireApiPlatformAdmin,
} from "@/features/admin/server/admin";

// Annuler le dernier paiement d'une agence, avec un motif (administrateur
// seulement) : la fin d'abonnement revient à celle d'avant
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("admin payment cancel", async () => {
    const admin = await requireApiPlatformAdmin();
    const paymentId = parseId((await params).id);
    const { reason } = await parseBody(request, cancelPlatformPaymentSchema);
    const endsAt = await cancelPlatformPayment(admin.userId, paymentId, reason);
    return ok({ ok: true, endsAt });
  });
}
