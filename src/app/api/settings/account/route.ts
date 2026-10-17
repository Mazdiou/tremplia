import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { ownNameSchema } from "@/features/settings/schemas";
import { updateOwnName } from "@/features/settings/server/settings";

// Prénom et nom du membre connecté
export function PATCH(request: Request) {
  return safely("settings account", async () => {
    const member = await requireApiMember();
    const input = await parseBody(request, ownNameSchema);
    await updateOwnName(member, input);
    return ok();
  });
}
