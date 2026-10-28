// Connexion avec Google (bouton de Google Identity Services, jeton donné à
// Supabase). Seulement pour les comptes qui existent déjà : l'inscription
// d'une agence reste le formulaire de /register.

// Identifiant OAuth « Application Web » de Google Cloud. Sans lui, le
// bouton n'est pas affiché. Figé au build, comme NEXT_PUBLIC_SENTRY_DSN.
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

// Nonce de la connexion : Google l'inscrit, haché, dans le jeton ; Supabase
// vérifie qu'il correspond à la valeur brute. Un jeton intercepté ne sert
// donc pas à ouvrir une autre session.
export async function createNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = toHex(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return { raw, hashed: toHex(new Uint8Array(digest)) };
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Refus de Supabase traduit pour la personne qui se connecte
export function googleSignInError(error: { code?: string; status?: number }): string {
  // Inscriptions fermées dans Supabase : une adresse Google inconnue n'ouvre
  // pas de compte
  if (error.code === "signup_disabled") return NO_ACCOUNT;
  // Employé désactivé par le patron
  if (error.code === "user_banned") {
    return "Ce compte est désactivé. Adressez-vous au patron de votre agence.";
  }
  if (error.status === 429) return "Trop d'essais. Réessayez dans quelques minutes.";
  if (error.code === "provider_disabled") {
    return "La connexion avec Google n'est pas disponible pour le moment. Utilisez votre mot de passe.";
  }
  return "Connexion avec Google impossible. Réessayez ou utilisez votre mot de passe.";
}

export const NO_ACCOUNT =
  "Aucun compte n'utilise cette adresse Google. Connectez-vous avec l'adresse de votre compte, ou créez votre agence ci-dessous.";
