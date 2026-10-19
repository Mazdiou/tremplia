import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Démarrage du serveur (Node.js et edge) : suivi des erreurs
export function register() {
  Sentry.init(sentryOptions);
}

// Erreur non rattrapée d'une page, d'une route ou du proxy
export const onRequestError = Sentry.captureRequestError;
