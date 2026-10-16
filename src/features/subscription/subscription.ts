import { dayFormat } from "@/lib/dates";
import { plural } from "@/lib/plural";

// Abonnement d'une agence (voir la migration subscriptions) : essai, actif
// ou expiré. Expiré = lecture seule, imposée par la base. L'agence de
// l'administrateur de la plateforme est exemptée : pas d'abonnement du tout.
export type SubscriptionState = "trial" | "active" | "expired" | "exempt";

export type Subscription = {
  state: SubscriptionState;
  // Instant de fin (ISO)
  endsAt: string;
};

// Bandeau affiché à partir de 7 jours de la fin d'un abonnement payé
export const RENEWAL_NOTICE_DAYS = 7;

const DAY_MS = 86_400_000;

// Jours restants, arrondis au-dessus : « 1 jour » jusqu'à la dernière minute
export function daysLeft(endsAt: string, now = new Date()): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now.getTime()) / DAY_MS));
}

// « 22/10/2026 », dans le fuseau de l'application
export function formatEndDate(endsAt: string): string {
  return dayFormat.format(new Date(endsAt));
}

type SubscriptionNotice = { tone: "info" | "warn" | "bad"; text: string } | null;

// Texte du bandeau, sans le moyen de contact (ajouté par l'affichage) ; rien
// pour un abonnement payé qui court encore plus de 7 jours
export function subscriptionNotice(sub: Subscription, now = new Date()): SubscriptionNotice {
  if (sub.state === "exempt") return null;
  const date = formatEndDate(sub.endsAt);
  const n = daysLeft(sub.endsAt, now);
  if (sub.state === "expired") {
    return {
      tone: "bad",
      text: `Abonnement expiré le ${date} : vos données restent consultables, mais plus rien ne peut être ajouté ni modifié. Pour le renouveler`,
    };
  }
  if (sub.state === "trial") {
    return {
      tone: "info",
      text: `Essai gratuit : ${plural(n, "jour restant", "jours restants")} (jusqu'au ${date}). Pour continuer après`,
    };
  }
  if (n <= RENEWAL_NOTICE_DAYS) {
    return {
      tone: "warn",
      text: `Votre abonnement se termine le ${date} (dans ${plural(n, "jour")}). Pensez à le renouveler`,
    };
  }
  return null;
}

export const STATE_LABELS: Record<SubscriptionState, string> = {
  trial: "Essai",
  active: "Actif",
  expired: "Expiré",
  exempt: "Administration",
};

// Teinte de la pastille d'état (voir StatusPill)
export const STATE_TONES = {
  trial: "info",
  active: "ok",
  expired: "bad",
  exempt: "off",
} as const satisfies Record<SubscriptionState, string>;

// Moyens de paiement de l'abonnement (voir PLATFORM_PAYMENT_METHODS)
export const PLATFORM_PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Espèces",
  ccp: "CCP",
  baridimob: "BaridiMob",
};

// Un moyen inconnu s'affiche tel quel
export function platformPaymentMethodLabel(method: string) {
  return PLATFORM_PAYMENT_METHOD_LABELS[method] ?? method;
}

// Message montré au candidat d'une agence en lecture seule
export const STUDENT_READ_ONLY =
  "Votre agence ne peut pas traiter de demande pour le moment. Vous pouvez toujours consulter votre dossier.";
