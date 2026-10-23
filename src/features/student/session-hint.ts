// Nom du cookie de session du candidat (signé : voir server/session.ts)
export const STUDENT_COOKIE = "sf_student";

// Indice seulement, sans vérifier la signature : un cookie de session
// candidat non expiré est présent sur cet appareil. Sert à ouvrir l'espace
// candidat plutôt que la connexion de l'agence ; la session est ensuite
// vérifiée pour de bon par les pages du candidat.
export function hasStudentSessionHint(value: string | undefined, now = Date.now()) {
  const body = value?.split(".")[0];
  if (!body) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { e?: unknown };
    return typeof payload.e === "number" && payload.e > now / 1000;
  } catch {
    return false;
  }
}
