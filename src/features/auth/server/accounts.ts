import "server-only";
import { ApiError, dbError, rateLimited } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { ipHash } from "@/features/student/server/keys";
import type { RegisterInput } from "../schemas";
import { reportError } from "@/lib/report-error";
import { sendWelcomeConfirmation } from "./emails";
import { LEGAL } from "@/config/legal";

// Mot de passe refusé par Supabase Auth (trop court ou trop simple selon ses
// réglages) : message sur le champ, sinon null
export function weakPasswordError(error: { code?: string } | null) {
  if (error?.code !== "weak_password") return null;
  return new ApiError(400, "Mot de passe trop faible : choisissez-en un plus long ou plus varié", {
    fields: [{ path: "password", message: "Mot de passe trop faible" }],
  });
}

// Inscription d'une agence : compte du patron, agence et profil. Essais
// limités par adresse IP (gardée seulement en empreinte). Le compte reste
// fermé (Supabase refuse la connexion) tant que l'adresse n'est pas
// confirmée par le lien envoyé. Renvoie false si cet e-mail n'est pas parti.
export async function registerAgency(input: RegisterInput, ip: string): Promise<boolean> {
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
    email_confirm: false,
  });
  if (authError || !created.user) {
    throw weakPasswordError(authError) ?? new ApiError(400, "Impossible de créer le compte (e-mail déjà utilisé)");
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
    // Version des conditions acceptées à l'inscription
    details: { terms: LEGAL.updatedAt },
  });

  return sendWelcomeConfirmation(input.email, input.firstName);
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
  if (pwError) {
    const weak = weakPasswordError(pwError);
    if (weak) throw weak;
    reportError("[change-password]", pwError.code ?? pwError.status);
    throw new ApiError(500, "Changement impossible");
  }

  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);
  if (flagError) {
    reportError("[change-password]", flagError.code);
    throw new ApiError(500, "Changement impossible");
  }
}

// Nouveau mot de passe choisi après « Mot de passe oublié ». Un mot de
// passe temporaire est remplacé du même coup.
export async function resetPasswordFromLink(userId: string, password: string) {
  const admin = createAdminClient();
  const { data: profile, error: readError } = await admin
    .from("profiles")
    .select("agency_id, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (readError) {
    reportError("[reset-password]", readError.code);
    throw new ApiError(500, "Changement impossible");
  }
  if (!profile?.is_active) throw new ApiError(403, "Compte désactivé");

  const { error: pwError } = await admin.auth.admin.updateUserById(userId, { password });
  if (pwError) {
    const weak = weakPasswordError(pwError);
    if (weak) throw weak;
    reportError("[reset-password]", pwError.code ?? pwError.status);
    throw new ApiError(500, "Changement impossible");
  }

  const { error: flagError } = await admin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);
  if (flagError) reportError("[reset-password]", flagError.code);

  await logActivity(admin, {
    agencyId: profile.agency_id as string,
    actorId: userId,
    action: "account.password_changed",
    targetType: "profile",
    targetId: userId,
  });
}
