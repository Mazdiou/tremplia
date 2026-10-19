import "server-only";
import { cache } from "react";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { ApiError, dbError, rateLimited } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  AgencyProfileInput,
  CampaignDefaultsInput,
  OwnNameInput,
  PasswordChangeInput,
} from "../schemas";
import { reportError } from "@/lib/report-error";

// Réglages de l'agence et du compte. Les fonctions SQL revérifient l'acteur,
// son rôle et l'abonnement ; l'agence vient toujours de la session.

export type AgencySettings = {
  name: string;
  city: string;
  phone: string;
  defaultFee: number | null;
  defaultPlatforms: string[];
  // null : la liste par défaut de l'application
  defaultStages: string[] | null;
};

// Lecture via le RLS : seule l'agence de la session est visible. Mise en
// cache pour la durée d'un affichage.
export const getAgencySettings = cache(
  async (agencyId: string): Promise<AgencySettings | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("agencies")
      .select("name, city, phone, default_fee, default_platforms, default_stages")
      .eq("id", agencyId)
      .maybeSingle();
    if (error) reportError("[settings read]", error.code);
    if (!data) return null;
    return {
      name: data.name as string,
      city: data.city as string,
      phone: data.phone as string,
      defaultFee: (data.default_fee as number | null) ?? null,
      defaultPlatforms: (data.default_platforms as string[] | null) ?? [],
      defaultStages: (data.default_stages as string[] | null) ?? null,
    };
  },
);

export async function updateAgencyProfile(owner: Member, input: AgencyProfileInput) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("update_agency_profile", {
    p_agency_id: owner.agencyId,
    p_actor_id: owner.userId,
    p_name: input.name,
    p_city: input.city,
    p_phone: input.phone,
  });
  if (error) throw dbError("settings agency", error);
  await logActivity(admin, {
    agencyId: owner.agencyId,
    actorId: owner.userId,
    action: "agency.updated",
    targetType: "agency",
    targetId: owner.agencyId,
  });
}

export async function updateCampaignDefaults(owner: Member, input: CampaignDefaultsInput) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("update_agency_defaults", {
    p_agency_id: owner.agencyId,
    p_actor_id: owner.userId,
    p_default_fee: input.defaultFee ?? null,
    p_default_platforms: input.platforms,
    p_default_stages: input.stages,
  });
  if (error) throw dbError("settings defaults", error);
  await logActivity(admin, {
    agencyId: owner.agencyId,
    actorId: owner.userId,
    action: "agency.defaults_updated",
    targetType: "agency",
    targetId: owner.agencyId,
  });
}

export async function updateOwnName(member: Member, input: OwnNameInput) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("update_own_name", {
    p_agency_id: member.agencyId,
    p_user_id: member.userId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
  });
  if (error) throw dbError("settings name", error);
}

const WRONG_PASSWORD = "Mot de passe actuel incorrect";

// Changement du mot de passe par le membre lui-même : l'actuel est demandé,
// sinon une session volée suffirait à prendre le compte. Essais limités par
// compte (5 sur 15 minutes, migration agency_settings).
export async function changeOwnPassword(member: Member, input: PasswordChangeInput) {
  const admin = createAdminClient();

  const { error: limitError } = await admin.rpc("password_check_allowed", {
    p_user_id: member.userId,
  });
  if (limitError) {
    throw (
      rateLimited(limitError, "Trop d'essais. Réessayez dans 15 minutes.") ??
      dbError("password limit", limitError)
    );
  }

  const { data: account, error: readError } = await admin.auth.admin.getUserById(member.userId);
  const email = account.user?.email;
  if (readError || !email) throw new ApiError(500, "Changement impossible");

  // Vérification sur un client à part, sans session gardée : celle de la
  // requête n'est pas touchée
  const env = publicEnv();
  const checker = createSupabaseClient(env.supabaseUrl, env.supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: checkError } = await checker.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  });
  if (checkError) {
    if (checkError.code === "invalid_credentials") {
      const { error: failError } = await admin.rpc("password_check_failed", {
        p_user_id: member.userId,
      });
      if (failError) reportError("[password failure]", failError.code);
      throw new ApiError(400, WRONG_PASSWORD, {
        fields: [{ path: "currentPassword", message: WRONG_PASSWORD }],
      });
    }
    if (checkError.status === 429) {
      throw new ApiError(429, "Trop d'essais. Réessayez dans quelques minutes.");
    }
    reportError("[password check]", checkError.code ?? checkError.status);
    throw new ApiError(500, "Changement impossible");
  }
  // La session ouverte pour la vérification ne sert plus
  await checker.auth.signOut({ scope: "local" });

  const { error: updateError } = await admin.auth.admin.updateUserById(member.userId, {
    password: input.password,
  });
  if (updateError) {
    if (updateError.code === "weak_password") {
      throw new ApiError(400, "Mot de passe trop faible : choisissez-en un plus long ou plus varié", {
        fields: [{ path: "password", message: "Mot de passe trop faible" }],
      });
    }
    reportError("[password update]", updateError.code ?? updateError.status);
    throw new ApiError(500, "Changement impossible");
  }

  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "account.password_changed",
    targetType: "profile",
    targetId: member.userId,
  });
}
