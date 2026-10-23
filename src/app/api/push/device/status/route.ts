import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { pushEndpointSchema } from "@/features/notifications/schemas";
import { isMemberDevice } from "@/features/notifications/server/devices";

// Cet appareil reçoit-il les notifications du membre connecté ? (POST :
// l'adresse de l'appareil ne passe pas dans l'URL)
export function POST(request: Request) {
  return safely("push device status", async () => {
    const member = await requireApiMember();
    const { endpoint } = await parseBody(request, pushEndpointSchema);
    return ok({ registered: await isMemberDevice(member, endpoint) });
  });
}
