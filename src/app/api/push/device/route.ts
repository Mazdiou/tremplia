import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { pushEndpointSchema, pushSubscriptionSchema } from "@/features/notifications/schemas";
import { removeMemberDevice, saveMemberDevice } from "@/features/notifications/server/devices";

// Notifications sur cet appareil, pour le membre connecté : activer
export function POST(request: Request) {
  return safely("push device save", async () => {
    const member = await requireApiMember();
    const subscription = await parseBody(request, pushSubscriptionSchema);
    await saveMemberDevice(member, subscription);
    return ok({ ok: true }, 201);
  });
}

// … et désactiver (aussi à la déconnexion)
export function DELETE(request: Request) {
  return safely("push device remove", async () => {
    const member = await requireApiMember();
    const { endpoint } = await parseBody(request, pushEndpointSchema);
    await removeMemberDevice(member, endpoint);
    return ok();
  });
}
