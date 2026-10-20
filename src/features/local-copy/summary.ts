import { plural } from "@/lib/plural";
import type { SyncResult } from "./sync";

// Phrase affichée après une mise à jour de la copie
export function copySummary(r: SyncResult): { text: string; error: boolean } {
  const parts = [
    r.copied > 0 && plural(r.copied, "document copié", "documents copiés"),
    r.removed > 0 && plural(r.removed, "fichier retiré", "fichiers retirés"),
  ].filter(Boolean);

  if (r.failed > 0) {
    const done = parts.length > 0 ? ` (${parts.join(", ")})` : "";
    return {
      text: `${plural(r.failed, "document n'a pas pu être copié", "documents n'ont pas pu être copiés")}${done}. Un fichier est peut-être ouvert dans un autre programme : fermez-le et réessayez.`,
      error: true,
    };
  }
  if (parts.length === 0) return { text: "La copie est déjà à jour.", error: false };
  return { text: `Copie à jour : ${parts.join(", ")}.`, error: false };
}
