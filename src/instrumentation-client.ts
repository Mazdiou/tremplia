import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";
import { TUNNEL_PATH } from "@/lib/sentry-tunnel";

// Navigateur : erreurs JavaScript non rattrapées et pages en erreur (voir
// app/error.tsx). Ni enregistrement de session (replay, non activé : il
// filmerait les données des candidats), ni signal de session à chaque page
// (trafic inutile sur une connexion lente). Envoi par le site lui-même
// (tunnel) : les bloqueurs de publicité arrêtent les requêtes vers sentry.io.
Sentry.init({
  ...sentryOptions,
  tunnel: TUNNEL_PATH,
  integrations: (defaults) => defaults.filter((i) => i.name !== "BrowserSession"),
});
