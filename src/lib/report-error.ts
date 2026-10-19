import * as Sentry from "@sentry/nextjs";

// Anomalie côté serveur : écrite dans les logs et signalée au suivi des
// erreurs. Seulement une étiquette et un code (« [tasks count] 42P01 »),
// jamais un message d'erreur, qui pourrait contenir une donnée personnelle.
export function reportError(label: string, ...details: unknown[]) {
  console.error(label, ...details);
  Sentry.captureMessage([label, ...details.map(String)].join(" "), "error");
}

// Exception inattendue : la trace (fichiers et lignes) part au suivi des
// erreurs, les logs ne gardent que son nom
export function reportException(label: string, error: unknown) {
  console.error(label, error instanceof Error ? error.name : "erreur");
  Sentry.captureException(error, { tags: { where: label } });
}
