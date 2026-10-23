import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { pushEndpointSchema } from "@/features/notifications/schemas";
import { sendTestPush } from "@/features/notifications/server/devices";

// Notification d'essai, vers cet appareil seulement
export function POST(request: Request) {
  return safely("push test", async () => {
    const member = await requireApiMember();
    const { endpoint } = await parseBody(request, pushEndpointSchema);
    await sendTestPush(member, endpoint);
    return ok();
  });
}
