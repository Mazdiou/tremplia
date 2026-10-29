import { ok, parseBody, safely } from "@/lib/api-errors";
import { studentUploadSchema } from "@/features/document-requests/schemas";
import { prepareStudentUpload } from "@/features/document-requests/server/student";
import { requireApiStudent } from "@/features/student/server/session";

// Étape 1 de l'envoi d'une pièce par le candidat connecté : URL signée
export function POST(request: Request) {
  return safely("student documents upload-url", async () => {
    const session = await requireApiStudent();
    const input = await parseBody(request, studentUploadSchema);
    return ok(await prepareStudentUpload(session, input));
  });
}
