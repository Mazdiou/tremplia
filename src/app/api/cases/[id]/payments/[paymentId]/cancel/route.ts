import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { cancelPaymentSchema } from "@/features/payments/schemas";
import { cancelPayment } from "@/features/payments/server/payments";

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

// Annuler un paiement, avec un motif (patron seulement, revérifié par la base)
export function POST(request: Request, { params }: Ctx) {
  return safely("payments cancel", async () => {
    const { id, paymentId } = await params;
    const auth = await authorizeCase(id);
    const { reason } = await parseBody(request, cancelPaymentSchema);
    await cancelPayment(auth, id, parseId(paymentId), reason);
    return ok();
  });
}
