import { z } from "zod";
import { paymentAmountSchema } from "@/features/payments/schemas";
import { optionalText, requiredText } from "@/lib/validation";

// Règles partagées entre le navigateur et le serveur. La base impose les
// mêmes valeurs (migration subscriptions).

export const SUBSCRIPTION_MONTHS = [1, 3, 12] as const;
export type SubscriptionMonths = (typeof SUBSCRIPTION_MONTHS)[number];

export const PLATFORM_PAYMENT_METHODS = ["cash", "ccp", "baridimob"] as const;

// Mois offerts : enregistrés comme un paiement de moyen « gift » et de
// montant 0 (migration gift_months)
export const GIFT_METHOD = "gift" as const;

const monthsSchema = z.union([z.literal(1), z.literal(3), z.literal(12)], "Choisissez une durée");

export const platformPaymentSchema = z.object({
  months: monthsSchema,
  amount: paymentAmountSchema,
  method: z.enum(PLATFORM_PAYMENT_METHODS, "Choisissez le moyen de paiement"),
  note: optionalText(300),
});
export type PlatformPaymentInput = z.infer<typeof platformPaymentSchema>;

// « Offrir des mois » : le motif est obligatoire, pour se souvenir plus tard
// pourquoi l'agence n'a pas payé
export const giftMonthsSchema = z.object({
  months: monthsSchema,
  note: requiredText(300, "Indiquez pourquoi ces mois sont offerts"),
});
export type GiftMonthsInput = z.infer<typeof giftMonthsSchema>;

// Suppression d'une agence : son nom, retapé pour confirmer
export const deleteAgencySchema = z.object({
  confirmName: z.string().trim().min(1, "Tapez le nom de l'agence pour confirmer").max(200),
});

// Le nom retapé correspond-il ? (sans tenir compte des majuscules ni des
// espaces en trop)
export function sameAgencyName(typed: string, name: string) {
  const norm = (v: string) => v.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr");
  return norm(typed) === norm(name);
}

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
