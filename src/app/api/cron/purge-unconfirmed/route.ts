import { ApiError, ok, safely } from "@/lib/api-errors";
import { isCronAuthorized } from "@/lib/cron-auth";
import { purgeUnconfirmedRegistrations } from "@/features/auth/server/purge";

// Suppression des inscriptions jamais confirmées, une fois par jour. POST
// pour GitHub Actions, GET pour Vercel Cron : même protection (CRON_SECRET).
async function run(request: Request) {
  return safely("cron purge", async () => {
    if (!isCronAuthorized(request.headers.get("authorization"))) {
      throw new ApiError(401, "Non autorisé");
    }
    return ok({ deleted: await purgeUnconfirmedRegistrations() });
  });
}

export const GET = run;
export const POST = run;
