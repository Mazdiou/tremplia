import { ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { studentAccessSchema } from "@/features/student/schemas";
import { changeStudentAccess } from "@/features/student/server/access";

// Ouvrir, fermer l'accès du candidat ou changer son code (tout membre actif)
export function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("student access", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { action } = await parseBody(request, studentAccessSchema);
    await changeStudentAccess(auth, id, action);
    return ok();
  });
}
