import { ok, parseBody, safely } from "@/lib/api-errors";
import { pushTestSchema } from "@/features/notifications/schemas";
import { sendStudentTestPush } from "@/features/notifications/server/devices";
import { requireApiStudent } from "@/features/student/server/session";

// Essai différé : la fonction reste ouverte le temps de l'envoi
export const maxDuration = 60;

// Notification d'essai du candidat, vers cet appareil seulement
export function POST(request: Request) {
  return safely("student push test", async () => {
    const session = await requireApiStudent();
    const { endpoint, delayed } = await parseBody(request, pushTestSchema);
    await sendStudentTestPush(session, endpoint, delayed);
    return ok();
  });
}
