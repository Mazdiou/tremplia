import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { signupSettingsSchema } from "@/features/signup/schemas";
import { saveSignupSettings } from "@/features/signup/server/agency";

// Inscription en ligne (page activée, adresse, campagnes) : patron seulement
export function PATCH(request: Request) {
  return safely("settings signup", async () => {
    const owner = await requireApiOwner();
    const input = await parseBody(request, signupSettingsSchema);
    await saveSignupSettings(owner, input);
    return ok();
  });
}
