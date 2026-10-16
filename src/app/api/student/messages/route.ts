import { ok, parseBody, safely } from "@/lib/api-errors";
import { messageSchema } from "@/features/messages/schemas";
import { latestMessageId, sendStudentMessage } from "@/features/messages/server/messages";
import { requireApiStudent } from "@/features/student/server/session";

// Dernier message (vérification régulière de la conversation ouverte)
export function GET() {
  return safely("student messages latest", async () => {
    const session = await requireApiStudent();
    return ok({ last: await latestMessageId(session.agencyId, session.caseId) });
  });
}

// Message du candidat connecté à son agence
export function POST(request: Request) {
  return safely("student message send", async () => {
    const session = await requireApiStudent();
    const { body } = await parseBody(request, messageSchema);
    await sendStudentMessage(session, body);
    return ok({ ok: true }, 201);
  });
}
