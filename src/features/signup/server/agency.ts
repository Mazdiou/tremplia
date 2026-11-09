import "server-only";
import { cache } from "react";
import { ApiError, dbError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/report-error";
import type { CaseFieldsRecord } from "@/features/cases/case-record";
import type { SignupSettingsInput } from "../schemas";

// Côté agence : demandes reçues, refus, réglages de la page. Lectures via le
// RLS (agence de la session seulement) ; écritures par les fonctions SQL,
// qui revérifient l'acteur et l'abonnement.

export type Signup = {
  id: string;
  // Vide si la campagne a été supprimée depuis
  campaignId: string | null;
  fields: CaseFieldsRecord;
  message: string | null;
  createdAt: string;
};

const SIGNUP_COLUMNS = "id, campaign_id, fields, message, created_at";

function toSignup(row: Record<string, unknown>): Signup {
  const fields = row.fields as CaseFieldsRecord;
  return {
    id: row.id as string,
    campaignId: (row.campaign_id as string | null) ?? null,
    // Listes absentes des demandes sans diplôme ni test
    fields: { ...fields, diplomas: fields.diplomas ?? [], language_tests: fields.language_tests ?? [] },
    message: (row.message as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

// Demandes en attente, les plus récentes d'abord (500 au plus par agence)
export async function listSignups(): Promise<Signup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("online_signups")
    .select(SIGNUP_COLUMNS)
    .order("created_at", { ascending: false })
    .order("id")
    .limit(500);
  if (error) reportError("[signups list]", error.code);
  return (data ?? []).map(toSignup);
}

// Nombre de demandes en attente (arbre des dossiers). En cache pour la
// durée d'un affichage.
export const countSignups = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("online_signups")
    .select("id", { count: "exact", head: true });
  if (error) reportError("[signups count]", error.code);
  return count ?? 0;
});

// Ligne de l'arbre des dossiers : le nombre de demandes, ou null si la page
// n'a jamais servi (désactivée et aucune demande en attente)
export async function signupTreeCount(agencyId: string): Promise<number | null> {
  const supabase = await createClient();
  const [count, { data, error }] = await Promise.all([
    countSignups(),
    supabase.from("agencies").select("signup_enabled").eq("id", agencyId).maybeSingle(),
  ]);
  if (error) reportError("[signups tree]", error.code);
  return count > 0 || data?.signup_enabled ? count : null;
}

// Une demande de l'agence, ou null (déjà traitée, ou d'une autre agence)
export async function getSignup(id: string): Promise<Signup | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("online_signups")
    .select(SIGNUP_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) reportError("[signup read]", error.code);
  return data ? toSignup(data) : null;
}

// Refuser : la demande est supprimée (tout membre actif)
export async function refuseSignup(member: Member, id: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_online_signup", {
    p_signup_id: id,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
  });
  if (error) {
    throw dbError("signup refuse", error, {
      P0002: "Cette demande a déjà été traitée par un collègue.",
    });
  }
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "online_signup.refused",
    targetType: "online_signup",
    targetId: id,
  });
}

// Demandes restées sans réponse depuis SIGNUP_RETENTION_DAYS jours, dans
// toutes les agences. Lancé chaque matin avec la purge des inscriptions
// jamais confirmées. Renvoie le nombre de demandes supprimées.
export async function purgeOldSignups(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("purge_old_online_signups");
  if (error) throw dbError("purge signups", error);
  return typeof data === "number" ? data : 0;
}

export type SignupSettings = {
  enabled: boolean;
  slug: string | null;
  // Campagnes actives proposées sur la page
  openCampaignIds: string[];
};

export async function getSignupSettings(agencyId: string): Promise<SignupSettings> {
  const supabase = await createClient();
  const [agencyRes, campaignsRes] = await Promise.all([
    supabase.from("agencies").select("signup_enabled, signup_slug").eq("id", agencyId).maybeSingle(),
    supabase.from("campaigns").select("id").eq("status", "active").eq("signup_open", true),
  ]);
  if (agencyRes.error) reportError("[signup settings]", agencyRes.error.code);
  if (campaignsRes.error) reportError("[signup settings campaigns]", campaignsRes.error.code);
  return {
    enabled: Boolean(agencyRes.data?.signup_enabled),
    slug: (agencyRes.data?.signup_slug as string | null | undefined) ?? null,
    openCampaignIds: (campaignsRes.data ?? []).map((c) => c.id as string),
  };
}

export async function saveSignupSettings(owner: Member, input: SignupSettingsInput) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("save_signup_settings", {
    p_agency_id: owner.agencyId,
    p_actor_id: owner.userId,
    p_enabled: input.enabled,
    p_slug: input.slug ?? null,
    p_campaign_ids: input.campaignIds,
  });
  if (error) {
    if (error.code === "23505") {
      throw new ApiError(409, "Cette adresse est déjà prise par une autre agence", {
        fields: [{ path: "slug", message: "Adresse déjà prise : choisissez-en une autre" }],
      });
    }
    throw dbError("signup settings", error, {
      "22023": "Une des campagnes n'existe plus ou a été archivée. Rechargez la page.",
    });
  }
  await logActivity(admin, {
    agencyId: owner.agencyId,
    actorId: owner.userId,
    action: "agency.signup_updated",
    targetType: "agency",
    targetId: owner.agencyId,
    details: {
      enabled: input.enabled,
      slug: input.slug ?? null,
      campaigns: input.campaignIds.length,
    },
  });
}
