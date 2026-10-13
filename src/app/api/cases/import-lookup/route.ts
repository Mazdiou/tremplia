import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { importLookupSchema } from "@/features/cases/schemas";
import { findImportMatches } from "@/features/cases/server/lookups";

// Retrouver un candidat dans une autre campagne pour préremplir un nouveau
// dossier. POST : l'identité du candidat ne doit pas se retrouver dans une
// adresse, donc dans les journaux d'accès.
export function POST(request: Request) {
  return safely("cases import lookup", async () => {
    const member = await requireApiMember();
    const input = await parseBody(request, importLookupSchema);
    return ok({ matches: await findImportMatches(member, input) });
  });
}
