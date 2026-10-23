import { ok, parseBody, safely } from "@/lib/api-errors";
import { pushEndpointSchema, pushSubscriptionSchema } from "@/features/notifications/schemas";
import { removeStudentDevice, saveStudentDevice } from "@/features/notifications/server/devices";
import { requireApiStudent } from "@/features/student/server/session";

// Messages de l'agence sur cet appareil, pour le candidat connecté : activer
export function POST(request: Request) {
  return safely("student push save", async () => {
    const session = await requireApiStudent();
    const subscription = await parseBody(request, pushSubscriptionSchema);
    await saveStudentDevice(session, subscription);
    return ok({ ok: true }, 201);
  });
}

// … et désactiver (aussi à la déconnexion)
export function DELETE(request: Request) {
  return safely("student push remove", async () => {
    const session = await requireApiStudent();
    const { endpoint } = await parseBody(request, pushEndpointSchema);
    await removeStudentDevice(session, endpoint);
    return ok();
  });
}
