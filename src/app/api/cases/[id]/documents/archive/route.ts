import { ok, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { prepareArchive } from "@/features/documents/server/documents";

// Liens signés de tous les documents du dossier, pour l'archive ZIP
// construite par le navigateur (tout membre actif, comme l'ouverture d'un
// document). POST : jamais mis en cache.
export function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("documents archive", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    return ok(await prepareArchive(auth, id));
  });
}
