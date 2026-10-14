import { z } from "zod";
import { todayInAppTimezone } from "@/lib/dates";
import { MAX_AMOUNT, parseAmount } from "@/lib/money";
import { isoDateSchema, optionalText, requiredText } from "@/lib/validation";

// Règles partagées entre le navigateur et le serveur. La base impose les
// mêmes valeurs et limites (migration case_payments).

export const PAYMENT_METHODS = ["cash", "transfer", "ccp", "cheque", "card"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Espèces",
  transfer: "Virement",
  ccp: "CCP / BaridiMob",
  cheque: "Chèque",
  card: "Carte (CIB / Edahabia)",
};

// Un moyen inconnu s'affiche tel quel, sans faire planter la page
export function paymentMethodLabel(method: string) {
  return (PAYMENT_METHOD_LABELS as Record<string, string>)[method] ?? method;
}

// Montant en dinars : nombre, ou texte saisi (« 150 000 »)
function amount(min: number, emptyMessage: string) {
  return z.preprocess(
    (v) => (typeof v === "string" ? (parseAmount(v) ?? undefined) : v),
    z
      .number(emptyMessage)
      .int("Montant invalide")
      .min(min, min > 0 ? "Le montant doit être positif" : "Montant invalide")
      .max(MAX_AMOUNT, "Montant trop élevé"),
  );
}

export const agreedAmountSchema = amount(0, "Indiquez le montant convenu");
export const paymentAmountSchema = amount(1, "Indiquez le montant payé");

// Montant facultatif (montant convenu, tarif d'une campagne) : vide = absent
export const optionalAmountSchema = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  agreedAmountSchema.optional(),
);

export const setAgreedAmountSchema = z.object({ amount: agreedAmountSchema });

export const recordPaymentSchema = z.object({
  amount: paymentAmountSchema,
  paidOn: isoDateSchema.refine(
    (d) => d >= "2000-01-01" && d <= todayInAppTimezone(),
    "La date ne peut pas être dans le futur",
  ),
  method: z.enum(PAYMENT_METHODS, "Choisissez le moyen de paiement"),
  note: optionalText(300),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const cancelPaymentSchema = z.object({
  reason: requiredText(300, "Indiquez le motif de l'annulation"),
});

// Paiement fait à la création du dossier, le jour même
export const initialPaymentSchema = z.object({
  amount: paymentAmountSchema,
  method: z.enum(PAYMENT_METHODS, "Choisissez le moyen de paiement"),
});

// Résumé d'un dossier ------------------------------------------------------

export type PaymentState = "unset" | "unpaid" | "partial" | "paid";

export function paymentSummary(agreed: number | null, paid: number) {
  const remaining = agreed === null ? null : Math.max(agreed - paid, 0);
  const state: PaymentState =
    agreed === null ? "unset" : remaining === 0 ? "paid" : paid > 0 ? "partial" : "unpaid";
  const percent = agreed ? Math.min(100, Math.floor((paid / agreed) * 100)) : agreed === 0 ? 100 : 0;
  return { agreed, paid, remaining, state, percent };
}
