import "server-only";
import { ApiError, dbError, rateLimited } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipHash } from "@/features/student/server/keys";
import type { RegisterInput } from "../schemas";
import { reportError } from "@/lib/report-error";

// Inscription d'une agence : compte du patron, agence et profil. Essais
// limités par adresse IP (gardée seulement en empreinte).
export async function registerAgency(input: RegisterInput, ip: string) {
  const admin = createAdminClient();

  // 0. Essais limités : 3 par heure et par adresse, 30 en tout
  const { error: limitError } = await admin.rpc("register_attempt", { p_ip_hash: ipHash(ip) });
  if (limitError) {
    throw (
      rateLimited(limitError, "Trop d'inscriptions pour le moment. Réessayez dans une heure.") ??
      dbError("register limit", limitError)
    );
  }

  // 1. Création du compte Auth
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    throw new ApiError(400, "Impossible de créer le compte (e-mail déjà utilisé)");
  }

  // 2. Création de l'agence et du profil patron
  const { data: agencyId, error: rpcError } = await admin.rpc("create_agency_with_owner", {
    p_user_id: created.user.id,
    p_agency_name: input.agencyName,
    p_city: input.city,
    p_phone: input.phone,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
  });

  // 3. En cas d'échec, le compte Auth créé est supprimé
  if (rpcError || typeof agencyId !== "string") {
    await admin.auth.admin.deleteUser(created.user.id);
    if (rpcError) reportError("[register]", rpcError.code);
    throw new ApiError(500, "Erreur lors de la création de l'agence");
  }

  await logActivity(admin, {
    agencyId,
    actorId: created.user.id,
    action: "agency.created",
    targetType: "agency",
    targetId: agencyId,
  });
}

// Remplacement du mot de passe temporaire à la première connexion, et
// seulement à ce moment-là : sans ancien mot de passe demandé, une session
// volée ne doit pas pouvoir changer celui d'un compte.
export async function replaceTemporaryPassword(userId: string, password: string) {
  const admin = createAdminClient();
  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("is_active, must_change_password")
    .eq("id", userId)
    .maybeSingle();
  if (readError) {
    reportError("[change-password]", readError.code);
    throw new ApiError(500, "Changement impossible");
  }
  if (!profile?.is_active || profile.must_change_password !== true) {
    throw new ApiError(403, "Votre mot de passe est déjà choisi");
  }

  const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password });
  if (pwError) throw new ApiError(500, "Changement impossible");

  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);
  if (flagError) {
    reportError("[change-password]", flagError.code);
    throw new ApiError(500, "Changement impossible");
  }
}
