import { ApiError, ok, safely } from "@/lib/api-errors";
import { markReadByStudent } from "@/features/messages/server/messages";
import { getStudentSession } from "@/features/student/server/session";

// Conversation ouverte par le candidat : les réponses de l'agence sont lues
export function POST() {
  return safely("student messages read", async () => {
    const session = await getStudentSession();
    if (!session) throw new ApiError(401, "Votre session a expiré : reconnectez-vous");
    await markReadByStudent(session);
    return ok();
  });
}
