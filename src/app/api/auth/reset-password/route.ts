import { ApiError, ok, parseBody, safely } from "@/lib/api-errors";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/features/auth/schemas";
import { openedByEmailLink } from "@/features/auth/link-session";
import { resetPasswordFromLink } from "@/features/auth/server/accounts";

// Nouveau mot de passe après « Mot de passe oublié » : seulement pour une
// session ouverte par le lien reçu, depuis moins d'une heure
export function POST(request: Request) {
  return safely("reset-password", async () => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (!claims?.sub) throw new ApiError(401, "Lien expiré : demandez-en un nouveau");
    if (!openedByEmailLink(claims.amr)) {
      throw new ApiError(403, "Lien expiré : demandez-en un nouveau");
    }

    const { password } = await parseBody(request, changePasswordSchema);
    await resetPasswordFromLink(claims.sub, password);
    return ok();
  });
}
