import "server-only";
import { BRAND } from "@/config/brand";
import type { Email } from "./templates";

// Envoi d'un e-mail de l'application : par Resend avec RESEND_API_KEY
// (production) ; sinon, avec MAILPIT_URL, dans la boîte de test du Supabase
// local (Mailpit, http://127.0.0.1:54324), pour le développement et les
// tests ; sinon, hors production, le message est seulement écrit dans la
// console.
// Lève une erreur si l'envoi échoue : à l'appelant de décider (signaler,
// annuler un rappel…). Jamais le contenu dans l'erreur : il porte un lien
// de connexion.

class EmailError extends Error {
  constructor(readonly code: string) {
    super(`Envoi d'e-mail impossible (${code})`);
    this.name = "EmailError";
  }
}

type Message = Email & {
  to: string;
  // Même clé = même e-mail : Resend ignore un second envoi (24 h)
  idempotencyKey?: string;
};

const TIMEOUT_MS = 10_000;

export async function sendEmail(message: Message): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) return sendWithResend(resendKey, message);

  const mailpit = process.env.MAILPIT_URL?.trim();
  if (mailpit) return sendToMailpit(mailpit, message);

  if (process.env.NODE_ENV === "production") throw new EmailError("non-configure");
  console.info(`[e-mail non envoyé] À : ${message.to} – ${message.subject}\n${message.text}`);
}

async function sendWithResend(key: string, message: Message) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (message.idempotencyKey) headers["Idempotency-Key"] = message.idempotencyKey;
  const response = await post("https://api.resend.com/emails", headers, {
    from: `${BRAND.name} <${BRAND.email.from}>`,
    to: [message.to],
    reply_to: BRAND.email.contact,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (!response.ok) throw new EmailError(`resend-${response.status}`);
}

async function sendToMailpit(base: string, message: Message) {
  const response = await post(
    `${base.replace(/\/$/, "")}/api/v1/send`,
    { "Content-Type": "application/json" },
    {
      From: { Email: BRAND.email.from, Name: BRAND.name },
      To: [{ Email: message.to }],
      ReplyTo: [{ Email: BRAND.email.contact }],
      Subject: message.subject,
      HTML: message.html,
      Text: message.text,
    },
  );
  if (!response.ok) throw new EmailError(`mailpit-${response.status}`);
}

async function post(url: string, headers: Record<string, string>, body: unknown) {
  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new EmailError(error instanceof Error && error.name === "TimeoutError" ? "delai" : "reseau");
  }
}
