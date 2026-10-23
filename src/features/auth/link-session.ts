// Ouverture par un lien reçu par e-mail (mot de passe oublié) : depuis
// moins d'une heure. Une session ouverte avec le mot de passe ne suffit pas,
// comme pour replaceTemporaryPassword.
const LINK_SESSION_MAX_AGE_S = 3600;

export function openedByEmailLink(
  amr: unknown,
  nowS = Math.floor(Date.now() / 1000),
): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some(
    (entry: { method?: unknown; timestamp?: unknown }) =>
      entry?.method === "otp" &&
      typeof entry.timestamp === "number" &&
      nowS - entry.timestamp <= LINK_SESSION_MAX_AGE_S,
  );
}
