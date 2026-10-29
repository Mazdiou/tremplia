import { ok, parseBody, safely } from "@/lib/api-errors";
import { studentAddDocumentSchema } from "@/features/document-requests/schemas";
import { addStudentDocument } from "@/features/document-requests/server/student";
import { requireApiStudent } from "@/features/student/server/session";

// Étape 2 de l'envoi : vérifier le fichier reçu et le rattacher à sa pièce
export function POST(request: Request) {
  return safely("student documents add", async () => {
    const session = await requireApiStudent();
    const input = await parseBody(request, studentAddDocumentSchema);
    await addStudentDocument(session, input);
    return ok({ ok: true }, 201);
  });
}
