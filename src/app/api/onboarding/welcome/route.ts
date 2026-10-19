import { ok, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { markWelcomed } from "@/features/onboarding/server/onboarding";

// Mot de bienvenue vu par le membre connecté
export function POST() {
  return safely("onboarding welcome", async () => {
    const member = await requireApiMember();
    await markWelcomed(member);
    return ok();
  });
}
