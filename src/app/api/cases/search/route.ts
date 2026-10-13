import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { caseSearchSchema } from "@/features/cases/schemas";
import { searchCases } from "@/features/cases/server/lookups";

// Recherche globale par nom dans l'agence (20 résultats au plus).
// POST : la saisie (un nom) ne doit pas se retrouver dans une adresse.
export function POST(request: Request) {
  return safely("cases search", async () => {
    await requireApiMember();
    const { query } = await parseBody(request, caseSearchSchema);
    return ok({ results: await searchCases(query) });
  });
}
