import { ApiError, ok, safely } from "@/lib/api-errors";
import { isCronAuthorized } from "@/lib/cron-auth";
import { purgeUnconfirmedRegistrations } from "@/features/auth/server/purge";
import { purgeOldSignups } from "@/features/signup/server/agency";

// Suppression des inscriptions jamais confirmées et des demandes
// d'inscription en ligne restées sans réponse, une fois par jour. POST
// pour GitHub Actions, GET pour Vercel Cron : même protection (CRON_SECRET).
async function run(request: Request) {
  return safely("cron purge", async () => {
    if (!isCronAuthorized(request.headers.get("authorization"))) {
      throw new ApiError(401, "Non autorisé");
    }
    const [deleted, signups] = await Promise.all([
      purgeUnconfirmedRegistrations(),
      purgeOldSignups(),
    ]);
    return ok({ deleted, signups });
  });
}

export const GET = run;
export const POST = run;
