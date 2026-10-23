import { z } from "zod";
import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { pushEndpointSchema } from "@/features/notifications/schemas";
import { removeOtherMemberDevices } from "@/features/notifications/server/devices";

// null : cet appareil n'est pas abonné, ou se déconnecte aussi
const schema = z.object({ endpoint: pushEndpointSchema.shape.endpoint.nullable() });

// Après la déconnexion des autres appareils : ils ne reçoivent plus les
// notifications du membre connecté
export function DELETE(request: Request) {
  return safely("push devices remove", async () => {
    const member = await requireApiMember();
    const { endpoint } = await parseBody(request, schema);
    await removeOtherMemberDevices(member, endpoint);
    return ok();
  });
}
