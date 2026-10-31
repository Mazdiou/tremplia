import { ok, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { handOverAccounts } from "@/features/cases/server/external-accounts";

// Comptes du dossier avec leurs mots de passe, à remettre au candidat (tout
// membre actif). La remise est inscrite au journal AVANT la réponse, qui
// n'est jamais mise en cache.
export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("external accounts handover", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const accounts = await handOverAccounts(auth, id);
    return ok({ accounts });
  });
}
