import { ApiError, ok, safely } from "@/lib/api-errors";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendDueReminders } from "@/features/subscription/server/reminders";

// Rappels de fin d'essai ou d'abonnement, une fois par jour. POST pour
// GitHub Actions, GET pour Vercel Cron : même protection (CRON_SECRET).
async function run(request: Request) {
  return safely("cron reminders", async () => {
    if (!isCronAuthorized(request.headers.get("authorization"))) {
      throw new ApiError(401, "Non autorisé");
    }
    return ok(await sendDueReminders());
  });
}

export const GET = run;
export const POST = run;
