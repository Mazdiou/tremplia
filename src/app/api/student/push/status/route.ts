import { ok, parseBody, safely } from "@/lib/api-errors";
import { pushEndpointSchema } from "@/features/notifications/schemas";
import { isStudentDevice } from "@/features/notifications/server/devices";
import { requireApiStudent } from "@/features/student/server/session";

// Cet appareil reçoit-il les messages de l'agence ?
export function POST(request: Request) {
  return safely("student push status", async () => {
    const session = await requireApiStudent();
    const { endpoint } = await parseBody(request, pushEndpointSchema);
    return ok({ registered: await isStudentDevice(session, endpoint) });
  });
}
