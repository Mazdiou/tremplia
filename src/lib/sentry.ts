import type { ErrorEvent } from "@sentry/nextjs";

// Suivi des erreurs (Sentry), commun au serveur, à l'edge et au navigateur.
// Actif seulement là où NEXT_PUBLIC_SENTRY_DSN est défini (la production) :
// ni en local, ni pendant les tests. Aucune donnée personnelle n'est envoyée.

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Adresses e-mail et numéros de téléphone (8 chiffres ou plus, espaces,
// points ou tirets compris, pas au milieu d'un identifiant) qu'un message
// d'erreur pourrait contenir par accident
const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/gi;
const PHONE = /(?<![\w-])\+?\d(?:[\s.-]?\d){7,}(?![\w-])/g;

export function redact(text: string) {
  return text.replace(EMAIL, "[e-mail]").replace(PHONE, "[numéro]");
}

// Dernier filtre avant l'envoi : ni utilisateur, ni cookies, ni en-têtes, ni
// corps de requête ; e-mails et numéros masqués dans les messages
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.data;
    delete event.request.query_string;
  }
  if (event.message) event.message = redact(event.message);
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = redact(ex.value);
  }
  for (const b of event.breadcrumbs ?? []) {
    if (b.message) b.message = redact(b.message);
    // Messages de la console : arguments bruts (une erreur et son texte)
    if (b.category === "console") delete b.data;
    // Les adresses appelées peuvent porter une recherche (?q=…)
    if (typeof b.data?.url === "string") b.data.url = b.data.url.split("?")[0];
  }
  return event;
}

export const sentryOptions = {
  dsn: DSN,
  enabled: Boolean(DSN),
  // Version déployée (commit fourni par Vercel) : savoir laquelle a cassé
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "production",
  // Pas d'adresse IP ni d'identifiant de l'utilisateur
  sendDefaultPii: false,
  // Erreurs seulement : pas de mesure des performances
  tracesSampleRate: 0,
  beforeSend: scrubEvent,
};
