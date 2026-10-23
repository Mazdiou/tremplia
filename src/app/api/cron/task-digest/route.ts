import { ApiError, ok, safely } from "@/lib/api-errors";
import { isCronAuthorized } from "@/lib/cron-auth";
import { sendTaskDigests } from "@/features/notifications/server/events";

// Récapitulatif du matin (tâches du jour et en retard), une fois par jour.
// POST pour GitHub Actions, GET pour Vercel Cron : même protection
// (CRON_SECRET).
async function run(request: Request) {
  return safely("cron task digest", async () => {
    if (!isCronAuthorized(request.headers.get("authorization"))) {
      throw new ApiError(401, "Non autorisé");
    }
    return ok(await sendTaskDigests());
  });
}

export const GET = run;
export const POST = run;
