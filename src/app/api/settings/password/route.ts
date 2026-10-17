import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { passwordChangeSchema } from "@/features/settings/schemas";
import { changeOwnPassword } from "@/features/settings/server/settings";

// Nouveau mot de passe du membre connecté, l'actuel à l'appui
export function POST(request: Request) {
  return safely("settings password", async () => {
    const member = await requireApiMember();
    const input = await parseBody(request, passwordChangeSchema);
    await changeOwnPassword(member, input);
    return ok();
  });
}
