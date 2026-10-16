import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { newEmployeeSchema } from "@/features/team/schemas";
import { addEmployee } from "@/features/team/server/team";

// Ajouter un employé : patron seulement (revérifié par add_employee). Le mot
// de passe temporaire n'est renvoyé qu'une seule fois, au patron.
export function POST(request: Request) {
  return safely("team create", async () => {
    const owner = await requireApiOwner();
    const input = await parseBody(request, newEmployeeSchema);
    const temporaryPassword = await addEmployee(owner, input);
    return ok({ ok: true, temporaryPassword }, 201);
  });
}
