import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { setAgreedAmountSchema } from "@/features/payments/schemas";
import { setAgreedAmount } from "@/features/payments/server/payments";

// Fixer le montant convenu (tout membre s'il est vide, sinon le patron)
export function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("payments agreed amount", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { amount } = await parseBody(request, setAgreedAmountSchema);
    await setAgreedAmount(auth, id, amount);
    return ok();
  });
}
