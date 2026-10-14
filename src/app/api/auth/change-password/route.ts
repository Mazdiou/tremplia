import { ApiError, ok, parseBody, safely } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/features/auth/schemas";

// Remplacement du mot de passe temporaire à la première connexion, et
// seulement à ce moment-là : sans ancien mot de passe demandé, une session
// volée ne doit pas pouvoir changer celui d'un compte. (requireApiMember
// refuserait ce compte, qui doit justement encore changer son mot de passe.)
export function POST(request: Request) {
  return safely("change-password", async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non connecté");

    const { password } = await parseBody(request, changePasswordSchema);
    const admin = createAdminClient();

    const { data: profile, error: readError } = await admin
      .from("profiles")
      .select("is_active, must_change_password")
      .eq("id", user.id)
      .maybeSingle();
    if (readError) {
      console.error("[change-password]", readError.code);
      throw new ApiError(500, "Changement impossible");
    }
    if (!profile?.is_active || profile.must_change_password !== true) {
      throw new ApiError(403, "Votre mot de passe est déjà choisi");
    }

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
