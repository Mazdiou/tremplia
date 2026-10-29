import { BRAND } from "@/config/brand";
import { APP_TIMEZONE } from "@/lib/dates";

// E-mails de l'application : une seule mise en page (HTML simple en
// tableaux, lu par toutes les messageries, sans image ni police externe) et
// sa version texte. Le contenu est toujours échappé.

export type Email = { subject: string; html: string; text: string };

type Content = {
  title: string;
  paragraphs: string[];
  action?: { label: string; url: string };
  note?: string;
};

const FONT = "Arial,Helvetica,sans-serif";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmail(subject: string, content: Content): Email {
  const p = (text: string, style = "margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155") =>
    `<p style="${style}">${escapeHtml(text)}</p>`;

  const action = content.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr>` +
      `<td style="border-radius:10px;background:${BRAND.colors.primary}">` +
      `<a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px">${escapeHtml(content.action.label)}</a>` +
      `</td></tr></table>` +
      `<p style="margin:0 0 16px;font-size:13px;line-height:1.6;color:#64748b">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>` +
      `<a href="${escapeHtml(content.action.url)}" style="color:${BRAND.colors.primary};word-break:break-all">${escapeHtml(content.action.url)}</a></p>`
    : "";

  const note = content.note
    ? p(content.note, "margin:16px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.6;color:#64748b")
    : "";

  const html =
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:${BRAND.colors.background}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.colors.background}"><tr><td align="center" style="padding:32px 16px">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">` +
    `<tr><td style="padding:0 4px 20px;font-family:${FONT};font-size:22px;font-weight:700;color:${BRAND.colors.primary}">${escapeHtml(BRAND.name)}</td></tr>` +
    `<tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:32px 28px;font-family:${FONT};color:#0f172a">` +
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0f172a">${escapeHtml(content.title)}</h1>` +
    content.paragraphs.map((text) => p(text)).join("") +
    action +
    note +
    `</td></tr>` +
    `<tr><td style="padding:20px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:#64748b">` +
    `${escapeHtml(`${BRAND.name} – ${BRAND.tagline}`)}<br>` +
    `Message envoyé automatiquement. Pour nous écrire : ` +
    `<a href="mailto:${BRAND.email.contact}" style="color:#64748b">${BRAND.email.contact}</a>` +
    `</td></tr></table></td></tr></table></body></html>`;

  const text = [
    content.title,
    ...content.paragraphs,
    content.action ? `${content.action.label} : ${content.action.url}` : null,
    content.note ?? null,
    `--\n${BRAND.name} – ${BRAND.tagline}\nPour nous écrire : ${BRAND.email.contact}`,
  ]
    .filter((part): part is string => part !== null)
    .join("\n\n");

  return { subject, html, text };
}

// Lien de connexion envoyé par e-mail : la page /auth/confirm le vérifie
// (un seul usage, valable 1 heure). « recovery » mène au choix d'un nouveau
// mot de passe, « email » confirme l'adresse et ouvre la session.
type AuthLinkType = "recovery" | "email";

export function authLink(site: string, tokenHash: string, type: AuthLinkType) {
  return `${site}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=${type}`;
}

export function passwordResetEmail(link: string): Email {
  return renderEmail(`Votre nouveau mot de passe ${BRAND.name}`, {
    title: "Mot de passe oublié ?",
    paragraphs: [
      `Vous avez demandé à choisir un nouveau mot de passe pour votre compte ${BRAND.name}.`,
    ],
    action: { label: "Choisir un nouveau mot de passe", url: link },
    note:
      "Ce lien est valable 1 heure et ne sert qu'une fois. Si vous n'êtes pas à l'origine de " +
      "cette demande, ignorez cet e-mail : votre mot de passe actuel reste valable.",
  });
}

export function confirmEmailEmail(link: string, firstName?: string): Email {
  return renderEmail("Confirmez votre adresse e-mail", {
    title: `Bienvenue sur ${BRAND.name}`,
    paragraphs: [
      firstName ? `Bonjour ${firstName},` : "Bonjour,",
      "Pour activer le compte de votre agence, confirmez votre adresse e-mail.",
    ],
    action: { label: "Confirmer mon adresse", url: link },
    note:
      "Ce lien est valable 1 heure. Expiré ? Demandez-en un nouveau depuis la page de connexion. " +
      "Si vous n'avez pas créé de compte, ignorez cet e-mail.",
  });
}

// « jeudi 30 octobre 2026 », jour vu en Algérie
export function formatReminderDate(endsAt: string) {
  return new Date(endsAt).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: APP_TIMEZONE,
  });
}

export type ReminderKind = "j7" | "j1";

export function subscriptionReminderEmail(input: {
  kind: ReminderKind;
  trial: boolean;
  agencyName: string;
  firstName: string;
  endsAt: string;
  supportPhone: string | null;
  appUrl: string;
}): Email {
  const what = input.trial ? "essai gratuit" : "abonnement";
  const when = input.kind === "j1" ? "demain" : "dans 7 jours";
  const contact = input.supportPhone
    ? `contactez-nous au ${input.supportPhone} ou répondez simplement à cet e-mail`
    : "répondez simplement à cet e-mail";
  return renderEmail(
    `Votre ${input.trial ? "essai" : "abonnement"} ${BRAND.name} se termine ${when}`,
    {
      title: `Votre ${what} se termine ${when}`,
      paragraphs: [
        `Bonjour ${input.firstName},`,
        `L'${what} de l'agence « ${input.agencyName} » se termine le ${formatReminderDate(input.endsAt)}.`,
        "Ensuite, vos dossiers restent consultables, mais en lecture seule : plus aucun ajout ni aucune modification.",
        input.trial
          ? `Pour continuer avec ${BRAND.name}, ${contact}. Paiement en espèces, par CCP ou par BaridiMob.`
          : `Pour renouveler, ${contact}. Paiement en espèces, par CCP ou par BaridiMob.`,
      ],
      action: { label: `Ouvrir ${BRAND.name}`, url: input.appUrl },
    },
  );
}

// Modèles des e-mails que Supabase Auth envoie lui-même (actions du tableau
// de bord Supabase : « Send password recovery », « Send magic link »…),
// avec la même mise en page. Fichiers de supabase/templates/, à recopier
// dans Supabase en ligne (README, « E-mails ») ; un test vérifie qu'ils
// sont à jour.
const SUPABASE_LINK = (type: AuthLinkType) =>
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=${type}`;

export const SUPABASE_TEMPLATES: Record<string, Email> = {
  recovery: passwordResetEmail(SUPABASE_LINK("recovery")),
  magic_link: renderEmail(`Votre lien de connexion ${BRAND.name}`, {
    title: "Votre lien de connexion",
    paragraphs: [`Cliquez sur le bouton pour ouvrir votre compte ${BRAND.name}.`],
    action: { label: "Ouvrir mon compte", url: SUPABASE_LINK("email") },
    note: "Ce lien est valable 1 heure et ne sert qu'une fois. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.",
  }),
  confirmation: confirmEmailEmail(SUPABASE_LINK("email")),
};
