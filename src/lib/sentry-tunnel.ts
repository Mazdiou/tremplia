// Tunnel du suivi des erreurs : le navigateur envoie ses rapports d'erreur
// à /api/rapport (même site) plutôt qu'à sentry.io, que les bloqueurs de
// publicité arrêtent. Le serveur les transmet à Sentry, seulement pour le
// projet de NEXT_PUBLIC_SENTRY_DSN : jamais un relais vers une autre adresse.

export const TUNNEL_PATH = "/api/rapport";

// Un rapport d'erreur fait quelques dizaines de Ko ; au-delà, refusé
export const MAX_ENVELOPE_BYTES = 256 * 1024;

// Adresse Sentry où transmettre l'enveloppe, ou null si elle ne vise pas le
// projet attendu. L'enveloppe commence par une ligne JSON qui porte le DSN :
// {"dsn":"https://<clé>@<hôte>/<projet>", …}
export function tunnelTarget(envelope: string, expectedDsn: string | undefined): string | null {
  if (!expectedDsn) return null;
  const end = envelope.indexOf("\n");
  const firstLine = end === -1 ? envelope : envelope.slice(0, end);
  let dsn: URL;
  let expected: URL;
  try {
    const header = JSON.parse(firstLine) as { dsn?: unknown };
    if (typeof header.dsn !== "string") return null;
    dsn = new URL(header.dsn);
    expected = new URL(expectedDsn);
  } catch {
    return null;
  }
  const projectId = expected.pathname.replace(/^\/+/, "");
  if (
    dsn.protocol !== "https:" ||
    dsn.host !== expected.host ||
    dsn.username !== expected.username ||
    dsn.pathname.replace(/^\/+/, "") !== projectId ||
    !/^\d+$/.test(projectId)
  ) {
    return null;
  }
  // Adresse construite depuis le DSN attendu, jamais depuis la requête
  return `https://${expected.host}/api/${projectId}/envelope/`;
}
