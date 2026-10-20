import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError, dbError } from "@/lib/api-errors";
import { requireMember, type Member } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionState } from "@/features/subscription/subscription";
import { GIFT_METHOD, type GiftMonthsInput, type PlatformPaymentInput } from "../schemas";
import { reportError } from "@/lib/report-error";

// Administrateur de la plateforme : désigné à la main dans la table
// platform_admins (voir le README). Son compte est aussi celui d'une agence :
// la connexion et la barre de navigation restent les mêmes.

export const isPlatformAdmin = cache(async (userId: string): Promise<boolean> => {
  const { data, error } = await createAdminClient()
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) reportError("[platform admin]", error.code);
  return !!data;
});

// Pages : une page introuvable pour tout autre compte (rien ne révèle
// qu'une administration existe)
export async function requirePlatformAdminPage(): Promise<Member> {
  const member = await requireMember();
  if (!member || !(await isPlatformAdmin(member.userId))) notFound();
  return member;
}

// Routes API : même réponse qu'une route inexistante
export async function requireApiPlatformAdmin(): Promise<Member> {
  const member = await requireMember();
  if (!member || !(await isPlatformAdmin(member.userId))) {
    throw new ApiError(404, "Introuvable");
  }
  return member;
}

type AdminAgency = {
  id: string;
  name: string;
  city: string;
  phone: string;
  ownerName: string;
  createdAt: string;
  endsAt: string;
  state: SubscriptionState;
  cases: number;
  members: number;
};

export async function listAgencies(adminId: string): Promise<AdminAgency[]> {
  const { data, error } = await createAdminClient().rpc("platform_agencies", {
    p_admin_id: adminId,
  });
  if (error) throw dbError("admin agencies", error);
  return (
    (data ?? []) as {
      id: string;
      name: string;
      city: string;
      phone: string;
      owner_first_name: string | null;
      owner_last_name: string | null;
      created_at: string;
      ends_at: string;
      state: SubscriptionState;
      cases: number;
      members: number;
    }[]
  ).map((a) => ({
    id: a.id,
    name: a.name,
    city: a.city,
    phone: a.phone,
    ownerName: [a.owner_first_name, a.owner_last_name].filter(Boolean).join(" "),
    createdAt: a.created_at,
    endsAt: a.ends_at,
    state: a.state,
    cases: Number(a.cases),
    members: Number(a.members),
  }));
}

type AdminPayment = {
  id: string;
  months: number;
  amount: number;
  method: string;
  note: string | null;
  recordedAt: string;
  previousEndsAt: string;
  newEndsAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
};

// Paiements d'une agence, du plus récent au plus ancien (l'appelant a déjà
// vérifié qu'il est administrateur)
export async function listAgencyPayments(agencyId: string): Promise<AdminPayment[]> {
  const { data, error } = await createAdminClient()
    .from("platform_payments")
    .select(
      "id, months, amount, method, note, recorded_at, previous_ends_at, new_ends_at, cancelled_at, cancel_reason",
    )
    .eq("agency_id", agencyId)
    .order("new_ends_at", { ascending: false });
  if (error) throw dbError("admin payments", error);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    months: p.months as number,
    amount: p.amount as number,
    method: p.method as string,
    note: p.note as string | null,
    recordedAt: p.recorded_at as string,
    previousEndsAt: p.previous_ends_at as string,
    newEndsAt: p.new_ends_at as string,
    cancelledAt: p.cancelled_at as string | null,
    cancelReason: p.cancel_reason as string | null,
  }));
}

const MESSAGES = {
  P0002: "Introuvable",
  "42501": "Réservé à l'administrateur de la plateforme",
  "23514": "Données invalides",
  "55000": "Seul le dernier paiement non annulé peut être annulé",
};

export async function recordPlatformPayment(
  adminId: string,
  agencyId: string,
  input: PlatformPaymentInput | { months: number; amount: 0; method: typeof GIFT_METHOD; note: string },
): Promise<string> {
  const { data, error } = await createAdminClient().rpc("record_platform_payment", {
    p_admin_id: adminId,
    p_agency_id: agencyId,
    p_months: input.months,
    p_amount: input.amount,
    p_method: input.method,
    p_note: input.note ?? null,
  });
  if (error) throw dbError("admin payment", error, { ...MESSAGES, P0002: "Agence introuvable" });
  return data as string;
}

// « Offrir des mois » : un paiement de montant 0, même calcul de la fin
export function recordGiftMonths(
  adminId: string,
  agencyId: string,
  input: GiftMonthsInput,
): Promise<string> {
  return recordPlatformPayment(adminId, agencyId, {
    months: input.months,
    amount: 0,
    method: GIFT_METHOD,
    note: input.note,
  });
}

export async function cancelPlatformPayment(
  adminId: string,
  paymentId: string,
  reason: string,
): Promise<string> {
  const { data, error } = await createAdminClient().rpc("cancel_platform_payment", {
    p_admin_id: adminId,
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (error) throw dbError("admin payment cancel", error, { ...MESSAGES, P0002: "Paiement introuvable" });
  return data as string;
}
