import { ApiError, ok, parseBody, safely } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/features/auth/schemas";

// Remplacement du mot de passe temporaire à la première connexion. Seul
// contrôle : être connecté (requireApiMember refuserait ce compte, qui doit
// justement encore changer son mot de passe).
export function POST(request: Request) {
  return safely("change-password", async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non connecté");

    const { password } = await parseBody(request, changePasswordSchema);
    const admin = createAdminClient();

    const { error: pwError } = await admin.auth.admin.updateUserById(user.id, { password });
    if (pwError) throw new ApiError(500, "Changement impossible");

    const { error: flagError } = await admin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id);
    if (flagError) {
      console.error("[change-password]", flagError.code);
      throw new ApiError(500, "Changement impossible");
    }
    return ok();
  });
}
