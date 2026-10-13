import { ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { externalAccountUpdateSchema } from "@/features/cases/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { saveExternalAccount } from "@/features/cases/server/external-accounts";

// Modifier un compte externe ; sans nouveau mot de passe, l'ancien est gardé
export function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> },
) {
  return safely("external accounts update", async () => {
    const { id, accountId } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, externalAccountUpdateSchema);
    await saveExternalAccount(auth, id, parseId(accountId), input);
    return ok();
  });
}
