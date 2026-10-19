import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentry";

// Navigateur : erreurs JavaScript non rattrapées et pages en erreur (voir
// app/error.tsx). Ni enregistrement de session (replay, non activé : il
// filmerait les données des candidats), ni signal de session à chaque page
// (trafic inutile sur une connexion lente).
Sentry.init({
  ...sentryOptions,
  integrations: (defaults) => defaults.filter((i) => i.name !== "BrowserSession"),
});
