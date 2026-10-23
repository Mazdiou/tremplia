import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { pushTestSchema } from "@/features/notifications/schemas";
import { sendTestPush } from "@/features/notifications/server/devices";

// Essai différé : la fonction reste ouverte le temps de l'envoi
export const maxDuration = 60;

// Notification d'essai, vers cet appareil seulement
export function POST(request: Request) {
  return safely("push test", async () => {
    const member = await requireApiMember();
    const { endpoint, delayed } = await parseBody(request, pushTestSchema);
    await sendTestPush(member, endpoint, delayed);
    return ok();
  });
}
