import { ok, parseBody, safely } from "@/lib/api-errors";
import { requireApiMember } from "@/lib/auth/require-member";
import { notificationPreferencesSchema } from "@/features/notifications/schemas";
import { savePreferences } from "@/features/notifications/server/devices";

// Ce que le membre connecté veut recevoir (pour lui seul)
export function PUT(request: Request) {
  return safely("settings notifications", async () => {
    const member = await requireApiMember();
    const prefs = await parseBody(request, notificationPreferencesSchema);
    await savePreferences(member, prefs);
    return ok();
  });
}
