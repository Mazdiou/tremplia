import { ok, parseId, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { revealPassword } from "@/features/cases/server/external-accounts";

// Afficher un mot de passe (tout membre actif). Chaque affichage est inscrit
// au journal AVANT la réponse, qui n'est jamais mise en cache.
export function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; accountId: string }> },
) {
  return safely("external accounts reveal", async () => {
    const { id, accountId } = await params;
    const auth = await authorizeCase(id);
    const password = await revealPassword(auth, id, parseId(accountId));
    return ok({ password });
  });
}
