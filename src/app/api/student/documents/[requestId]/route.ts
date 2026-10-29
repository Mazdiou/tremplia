import { ok, parseId, safely } from "@/lib/api-errors";
import { removeStudentDocument } from "@/features/document-requests/server/student";
import { requireApiStudent } from "@/features/student/server/session";

// Retirer le document envoyé pour une pièce : elle repasse en attente
export function DELETE(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  return safely("student documents remove", async () => {
    const session = await requireApiStudent();
    const { requestId } = await params;
    await removeStudentDocument(session, parseId(requestId));
    return ok();
  });
}
