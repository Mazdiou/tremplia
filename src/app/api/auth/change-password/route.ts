import { ApiError, ok, parseBody, safely } from "@/lib/api-errors";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/features/auth/schemas";
import { replaceTemporaryPassword } from "@/features/auth/server/accounts";

// Mot de passe temporaire remplacé à la première connexion. La session est
// lue ici sans requireApiMember, qui refuserait justement ce compte.
export function POST(request: Request) {
  return safely("change-password", async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non connecté");

    const { password } = await parseBody(request, changePasswordSchema);
    await replaceTemporaryPassword(user.id, password);
    return ok();
  });
}
