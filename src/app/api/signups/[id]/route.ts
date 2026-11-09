import { ok, parseId, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { refuseSignup } from "@/features/signup/server/agency";

type Ctx = { params: Promise<{ id: string }> };

// Refuser une demande d'inscription en ligne : tout membre actif
export function DELETE(_request: Request, { params }: Ctx) {
  return safely("signup refuse", async () => {
    const member = await requireApiMember();
    const { id } = await params;
    await refuseSignup(member, parseId(id));
    return ok();
  });
}
