import "server-only";
import { cache } from "react";
import { ApiError, dbError, rateLimited } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";
import { toCaseRecord } from "@/features/cases/case-record";
import { ipHash } from "@/features/student/server/keys";
import { notifyOnlineSignup } from "@/features/notifications/server/events";
import { isSignupSlug, type SignupSubmitInput } from "../schemas";

// Page publique d'inscription d'une agence, sans compte : tout passe par le
// serveur (fonctions SQL de la migration online_signups).

export type SignupPage = {
  agencyName: string;
  agencyCity: string;
  agencyPhone: string;
  // Page activée, abonnement en cours et au moins une campagne proposée
  open: boolean;
  campaigns: { id: string; name: string }[];
};

// Page d'une adresse, ou null si elle n'existe pas. Mise en cache pour la
// durée d'un affichage (titre de l'onglet et page).
export const getSignupPage = cache(async (slug: string): Promise<SignupPage | null> => {
  if (!isSignupSlug(slug)) return null;
  const { data, error } = await createAdminClient()
    .rpc("online_signup_page", { p_slug: slug })
    .maybeSingle();
  if (error) {
    reportError("[signup page]", error.code);
    throw new Error("Page d'inscription illisible");
  }
  if (!data) return null;
  const row = data as {
    agency_name: string;
    agency_city: string;
    agency_phone: string;
    is_open: boolean;
    campaigns: { id: string; name: string }[];
  };
  return {
    agencyName: row.agency_name,
    agencyCity: row.agency_city,
    agencyPhone: row.agency_phone,
    open: row.is_open,
    campaigns: row.campaigns,
  };
});

const CLOSED = "Les inscriptions en ligne de cette agence sont fermées pour le moment.";

// Envoi d'une demande. Un robot qui remplit le champ piège reçoit la même
// réponse qu'un humain, sans que rien soit enregistré.
export async function submitSignup(slug: string, input: SignupSubmitInput, ip: string) {
  const admin = createAdminClient();

  // Essai compté à part : un envoi refusé ensuite compte aussi
  const { error: limitError } = await admin.rpc("online_signup_attempt", {
    p_slug: slug,
    p_ip_hash: ipHash(ip),
  });
  if (limitError) {
    throw (
      rateLimited(limitError, "Trop d'envois depuis cette connexion. Réessayez dans une heure.") ??
      dbError("signup limit", limitError)
    );
  }
  if (input.website) return;

  const { data, error } = await admin
    .rpc("submit_online_signup", {
      p_slug: slug,
      p_campaign_id: input.campaignId,
      p_fields: toCaseRecord(input),
      p_message: input.message ?? null,
    })
    .single();
  if (error) {
    if (error.code === "54000") {
      throw new ApiError(429, "L'agence reçoit trop de demandes en ce moment. Réessayez plus tard.");
    }
    throw dbError("signup submit", error, {
      P0002: CLOSED,
      "25006": CLOSED,
      "22023": "Cette campagne n'est plus proposée. Rechargez la page.",
      "23505": "Une demande à votre nom est déjà en attente : l'agence va vous contacter.",
    });
  }

  const { signup_id: signupId, agency_id: agencyId } = data as {
    signup_id: string;
    agency_id: string;
  };
  await logActivity(admin, {
    agencyId,
    actorId: null,
    action: "online_signup.received",
    targetType: "online_signup",
    targetId: signupId,
    details: { campaign_id: input.campaignId },
  });
  notifyOnlineSignup(agencyId, signupId);
}
