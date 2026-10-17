import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { agencyProfileSchema } from "@/features/settings/schemas";
import { updateAgencyProfile } from "@/features/settings/server/settings";

// Profil de l'agence (nom, ville, téléphone) : patron seulement
export function PATCH(request: Request) {
  return safely("settings agency", async () => {
    const owner = await requireApiOwner();
    const input = await parseBody(request, agencyProfileSchema);
    await updateAgencyProfile(owner, input);
    return ok();
  });
}
