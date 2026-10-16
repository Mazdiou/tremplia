import { formatDA } from "@/lib/money";

// Indicatif ajouté aux numéros saisis sans indicatif (Algérie)
const DEFAULT_COUNTRY_CODE = "213";

// Numéro au format attendu par WhatsApp (chiffres seuls, indicatif compris),
// ou null s'il ne peut pas être converti.
// « 0555 12 34 56 » → « 213555123456 » ; « +33 6… » et « 0033 6… » gardent
// leur indicatif.
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  // « +213 (0)555… » : le 0 entre parenthèses ne se compose pas
  const compact = phone
    .trim()
    .replace(/\(0\)/g, "")
    .replace(/[\s.\-()/]/g, "");
  let digits: string;
  if (compact.startsWith("+")) digits = compact.slice(1);
  else if (compact.startsWith("00")) digits = compact.slice(2);
  else if (/^0\d{8,9}$/.test(compact)) digits = DEFAULT_COUNTRY_CODE + compact.slice(1);
  else if (/^[567]\d{8}$/.test(compact)) digits = DEFAULT_COUNTRY_CODE + compact;
  else digits = compact;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

// Lien qui ouvre la conversation, message déjà écrit (modifiable avant l'envoi)
export function whatsAppUrl(number: string, text = ""): string {
  return text
    ? `https://wa.me/${number}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${number}`;
}

type WhatsAppTemplate = "empty" | "access" | "newMessage" | "payment" | "visit";

export const TEMPLATE_LABELS: Record<WhatsAppTemplate, string> = {
  empty: "Message vide",
  access: "Accès à l'espace candidat",
  newMessage: "Vous avez un nouveau message",
  payment: "Rappel de paiement",
  visit: "Merci de passer à l'agence",
};

export type WhatsAppContext = {
  // Prénom du candidat
  candidate: string;
  // Nom complet du contact secondaire quand le message lui est adressé
  parent?: string | null;
  agencyName: string;
  agencyPhone: string;
  // Adresse de connexion à l'espace candidat
  studentLink: string;
  accessCode?: string | null;
  remaining?: number | null;
};

// Texte d'un message prêt à envoyer. Au parent, on parle « du dossier de »
// l'étudiant. L'accès et les nouveaux messages ne s'adressent qu'au candidat.
export function whatsAppMessage(template: WhatsAppTemplate, ctx: WhatsAppContext): string {
  const to = ctx.parent ?? ctx.candidate;
  const forCase = ctx.parent ? `le dossier de ${ctx.candidate}` : "votre dossier";
  switch (template) {
    case "empty":
      return "";
    case "access":
      return [
        `Bonjour ${ctx.candidate}, voici votre espace candidat ${ctx.agencyName} :`,
        ctx.studentLink,
        `Votre code d'accès : ${ctx.accessCode ?? ""}`,
        "Vous pourrez y relire votre lettre de motivation et vos formations.",
      ].join("\n");
    // Le nom de l'agence signe le message : il peut commencer par « Agence »
    case "newMessage":
      return [
        `Bonjour ${ctx.candidate}, vous avez reçu un nouveau message dans votre espace candidat : ${ctx.studentLink}`,
        ctx.agencyName,
      ].join("\n");
    case "payment":
      return [
        `Bonjour ${to}, il reste ${formatDA(ctx.remaining ?? 0)} à régler pour ${forCase}. Vous pouvez passer à l'agence quand vous le souhaitez.`,
        ctx.agencyName,
      ].join("\n");
    case "visit":
      return [
        `Bonjour ${to}, merci de passer à l'agence dès que possible${ctx.parent ? ` pour ${forCase}` : ""}. Pour toute question : ${ctx.agencyPhone}.`,
        ctx.agencyName,
      ].join("\n");
  }
}

// Messages proposés pour un destinataire, selon l'état du dossier
export function availableTemplates(
  ctx: Pick<WhatsAppContext, "parent" | "accessCode" | "remaining">,
): WhatsAppTemplate[] {
  const list: WhatsAppTemplate[] = ["empty"];
  if (!ctx.parent && ctx.accessCode) list.push("access", "newMessage");
  if ((ctx.remaining ?? 0) > 0) list.push("payment");
  list.push("visit");
  return list;
}
