import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { recordPaymentSchema } from "@/features/payments/schemas";
import { recordPayment } from "@/features/payments/server/payments";

// Enregistrer un paiement reçu (tout membre actif)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("payments record", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, recordPaymentSchema);
    return ok({ id: await recordPayment(auth, id, input) }, 201);
  });
}
