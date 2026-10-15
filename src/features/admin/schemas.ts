import { z } from "zod";
import { paymentAmountSchema } from "@/features/payments/schemas";
import { optionalText, requiredText } from "@/lib/validation";

// Règles partagées entre le navigateur et le serveur. La base impose les
// mêmes valeurs (migration subscriptions).

export const SUBSCRIPTION_MONTHS = [1, 3, 12] as const;
export type SubscriptionMonths = (typeof SUBSCRIPTION_MONTHS)[number];

export const PLATFORM_PAYMENT_METHODS = ["cash", "ccp", "baridimob"] as const;
export type PlatformPaymentMethod = (typeof PLATFORM_PAYMENT_METHODS)[number];

export const platformPaymentSchema = z.object({
  months: z.union([z.literal(1), z.literal(3), z.literal(12)], "Choisissez une durée"),
  amount: paymentAmountSchema,
  method: z.enum(PLATFORM_PAYMENT_METHODS, "Choisissez le moyen de paiement"),
  note: optionalText(300),
});
export type PlatformPaymentInput = z.infer<typeof platformPaymentSchema>;

export const cancelPlatformPaymentSchema = z.object({
  reason: requiredText(300, "Indiquez le motif de l'annulation"),
});

// Nouvelle fin d'abonnement : la durée s'ajoute à la fin en cours, ou à
// maintenant si elle est passée (même règle que la base). Comme Postgres,
// un mois de plus le 31 janvier donne le 28 (ou 29) février, pas le 3 mars.
export function newEndDate(endsAt: string, months: number, now = new Date()): Date {
  const base = new Date(Math.max(Date.parse(endsAt), now.getTime()));
  const total = base.getUTCMonth() + months;
  const year = base.getUTCFullYear() + Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = new Date(base);
  d.setUTCFullYear(year, month, Math.min(base.getUTCDate(), lastDay));
  return d;
}
