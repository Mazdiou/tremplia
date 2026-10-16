import { normalizeName } from "@/lib/names";

// Saisie de la recherche globale : un numéro de téléphone (4 chiffres au
// moins, séparateurs ignorés) ou des mots du nom. Fonction pure.
type SearchQuery =
  | { kind: "phone"; pattern: string }
  | { kind: "name"; words: string[] };

export function parseSearchQuery(query: string): SearchQuery {
  const digits = query.replace(/[\s.+()/-]/g, "");
  if (/^\d{4,}$/.test(digits)) {
    // Chaque chiffre peut être séparé du suivant par autre chose qu'un
    // chiffre : « 0555123456 » retrouve « 0555 12 34 56 » ou « 0555-12-34-56 ».
    return { kind: "phone", pattern: digits.split("").join("[^0-9]*") };
  }
  return { kind: "name", words: normalizeName(query).split(" ").filter(Boolean) };
}
