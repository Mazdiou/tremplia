import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { createCaseSchema } from "@/features/cases/schemas";
import { createCase } from "@/features/cases/server/cases";

// Créer un dossier complet en une transaction : dossier, classement, comptes
// externes, note initiale. Doublon possible : 409 « possible_duplicate »
// tant que confirmDuplicate n'est pas vrai.
export function POST(request: Request) {
  return safely("cases create", async () => {
    const member = await requireApiMember();
    const input = await parseBody(request, createCaseSchema);
    const id = await createCase(member, input);
    return ok({ id }, 201);
  });
}
