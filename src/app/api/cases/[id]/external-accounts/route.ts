import { ok, parseBody, safely } from "@/lib/api-errors";
import { newExternalAccountSchema } from "@/features/cases/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { saveExternalAccount } from "@/features/cases/server/external-accounts";

// Ajouter un compte externe au dossier (tout membre actif)
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("external accounts create", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const input = await parseBody(request, newExternalAccountSchema);
    const accountId = await saveExternalAccount(auth, id, null, input);
    return ok({ id: accountId }, 201);
  });
}
