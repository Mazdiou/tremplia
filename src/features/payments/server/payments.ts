import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import { createClient } from "@/lib/supabase/server";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import type { RecordPaymentInput } from "@/features/payments/schemas";
import { fullName } from "@/lib/names";
import { isUuid } from "@/lib/validation";
import { reportError } from "@/lib/report-error";

// Paiements du candidat à l'agence. Tout membre actif enregistre un paiement
// et fixe un montant convenu encore vide ; annuler un paiement ou changer le
// montant convenu demande la permission « Corriger les paiements », que le
// patron a toujours (revérifié par les fonctions SQL, qui gardent aussi le
// total payé sous le montant convenu). Le journal garde les montants,
// jamais la note ni le motif d'annulation.

const MESSAGES = {
  P0002: "Paiement introuvable",
  "22003": "Le paiement dépasse le reste à payer",
  "55000": "Indiquez d'abord le montant convenu",
  "54000": "200 paiements au maximum par dossier",
  "23514": "Paiement invalide",
};

export type PaymentItem = {
  id: string;
  amount: number;
  paidOn: string;
  method: string;
  note: string | null;
  createdBy: string;
  createdAt: string;
  cancelled: { by: string; at: string; reason: string } | null;
};

const memberName = (p: { first_name: string; last_name: string } | null) =>
  p ? fullName(p.first_name, p.last_name) : "Un ancien membre";

// Lecture via le RLS : seuls les paiements de l'agence reviennent. Les plus
// récents d'abord.
export async function listPayments(caseId: string): Promise<PaymentItem[]> {
  if (!isUuid(caseId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("case_payments")
    .select(
      `id, amount, paid_on, method, note, created_at, cancelled_at, cancel_reason,
      author:profiles!case_payments_created_by_fk(first_name, last_name),
      canceller:profiles!case_payments_cancelled_by_fk(first_name, last_name)`,
    )
    .eq("case_id", caseId)
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) reportError("[payments list]", error.code);

  type Row = {
    id: string;
    amount: number;
    paid_on: string;
    method: string;
    note: string | null;
    created_at: string;
    cancelled_at: string | null;
    cancel_reason: string | null;
    author: { first_name: string; last_name: string } | null;
    canceller: { first_name: string; last_name: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    amount: r.amount,
    paidOn: r.paid_on,
    method: r.method,
    note: r.note,
    createdBy: memberName(r.author),
    createdAt: r.created_at,
    cancelled: r.cancelled_at
      ? { by: memberName(r.canceller), at: r.cancelled_at, reason: r.cancel_reason ?? "" }
      : null,
  }));
}

export async function setAgreedAmount(auth: AuthorizedCase, caseId: string, amount: number) {
  const { data: changed, error } = await auth.admin.rpc("set_case_agreed_amount", {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_amount: amount,
  });
  if (error) {
    throw dbError("payments agreed amount", error, {
      P0002: "Dossier introuvable",
      "42501": "Vous n'avez pas la permission de modifier le montant convenu",
      "22003": "Le montant convenu ne peut pas être inférieur au total déjà payé",
      "23514": "Montant invalide",
    });
  }
  if (changed === true) {
    await logCaseActivity(auth, caseId, {
      action: "payment.agreed_amount_set",
      targetType: "case",
      targetId: caseId,
      details: { amount },
    });
  }
}

export async function recordPayment(
  auth: AuthorizedCase,
  caseId: string,
  input: RecordPaymentInput,
) {
  const { data, error } = await auth.admin.rpc("record_case_payment", {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_amount: input.amount,
    p_paid_on: input.paidOn,
    p_method: input.method,
    p_note: input.note ?? null,
  });
  if (error) {
    throw dbError("payments record", error, {
      ...MESSAGES,
      P0002: "Dossier introuvable",
      "22007": "La date ne peut pas être dans le futur",
    });
  }
  if (typeof data !== "string") throw new ApiError(500, "Impossible d'enregistrer le paiement");

  await logCaseActivity(auth, caseId, {
    action: "payment.recorded",
    targetType: "case_payment",
    targetId: data,
    details: { amount: input.amount, method: input.method },
  });
  return data;
}

// Permission « Corriger les paiements »
export async function cancelPayment(
  auth: AuthorizedCase,
  caseId: string,
  paymentId: string,
  reason: string,
) {
  const { data: amount, error } = await auth.admin.rpc("cancel_case_payment", {
    p_payment_id: paymentId,
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_reason: reason,
  });
  if (error) {
    throw dbError("payments cancel", error, {
      ...MESSAGES,
      "42501": "Vous n'avez pas la permission d'annuler un paiement",
      "55000": "Ce paiement est déjà annulé",
      "23514": "Motif invalide",
    });
  }

  await logCaseActivity(auth, caseId, {
    action: "payment.cancelled",
    targetType: "case_payment",
    targetId: paymentId,
    details: { amount },
  });
}
