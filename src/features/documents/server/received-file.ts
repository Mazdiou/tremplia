import "server-only";
import { ApiError } from "@/lib/api-errors";
import type { createAdminClient } from "@/lib/supabase/admin";
import { MAX_DOCUMENT_BYTES } from "../schemas";

// Vérification d'un fichier envoyé directement au stockage par le
// navigateur (lien signé), avant de l'enregistrer comme document.

export type DocumentsStorage = ReturnType<
  ReturnType<typeof createAdminClient>["storage"]["from"]
>;

// Début d'un fichier reçu et sa taille, sans le télécharger en entier : lien
// signé lu avec un en-tête Range (5 premiers octets ; la taille totale est
// dans Content-Range). null si le fichier n'existe pas.
async function readFileHead(storage: DocumentsStorage, path: string) {
  const { data, error } = await storage.createSignedUrl(path, 60);
  if (error || !data) return null;
  const res = await fetch(data.signedUrl, {
    headers: { Range: "bytes=0-4" },
    cache: "no-store",
  });
  // Fichier vide : aucun octet à renvoyer
  if (res.status === 416) return { head: new Uint8Array(), size: 0 };
  if (!res.ok) return null;
  const body = new Uint8Array(await res.arrayBuffer());
  const total = res.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
  // Sans Content-Range (Range ignoré), la réponse est le fichier entier
  return { head: body.slice(0, 5), size: total ? Number(total) : body.length };
}

// Le fichier reçu doit être présent, faire 10 Mo au plus et être un PDF.
// Sinon il est supprimé et l'envoi refusé. Renvoie sa taille.
// À n'appeler que sur le chemin d'un envoi en cours, jamais sur celui d'un
// document déjà enregistré.
export async function checkReceivedPdf(storage: DocumentsStorage, path: string) {
  const file = await readFileHead(storage, path);
  if (!file) {
    throw new ApiError(400, "Le fichier n'a pas été reçu. Réessayez l'envoi.");
  }

  const isPdf = new TextDecoder().decode(file.head) === "%PDF-";
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES || !isPdf) {
    await storage.remove([path]);
    throw new ApiError(
      400,
      file.size > MAX_DOCUMENT_BYTES ? "Le fichier dépasse 10 Mo" : "Ce fichier n'est pas un PDF valide",
    );
  }
  return file.size;
}
