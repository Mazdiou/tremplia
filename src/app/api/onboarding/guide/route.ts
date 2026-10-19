import { z } from "zod";
import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiOwner } from "@/lib/auth/require-member";
import { setOnboardingHidden } from "@/features/onboarding/server/onboarding";

const guideSchema = z.object({ hidden: z.boolean() });

// Masquer ou réafficher le guide « Bien démarrer » : patron seulement
export function PUT(request: Request) {
  return safely("onboarding guide", async () => {
    const owner = await requireApiOwner();
    const { hidden } = await parseBody(request, guideSchema);
    await setOnboardingHidden(owner, hidden);
    return ok();
  });
}
