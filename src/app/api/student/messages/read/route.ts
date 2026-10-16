import { ok, safely } from "@/lib/api-errors";
import { markReadByStudent } from "@/features/messages/server/messages";
import { requireApiStudent } from "@/features/student/server/session";

// Conversation ouverte par le candidat : les réponses de l'agence sont lues
export function POST() {
  return safely("student messages read", async () => {
    const session = await requireApiStudent();
    await markReadByStudent(session);
    return ok();
  });
}
