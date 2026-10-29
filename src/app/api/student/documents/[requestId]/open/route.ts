import { ok, parseId, safely } from "@/lib/api-errors";
import { studentDocumentUrl } from "@/features/document-requests/server/student";
import { requireApiStudent } from "@/features/student/server/session";

// Lien signé valable une minute vers le document envoyé pour une pièce
export function POST(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  return safely("student documents open", async () => {
    const session = await requireApiStudent();
    const { requestId } = await params;
    return ok({ url: await studentDocumentUrl(session, parseId(requestId)) });
  });
}
