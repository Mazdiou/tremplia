import { callApi } from "@/lib/api-client";
import { loadClient } from "@/lib/supabase/lazy-client";
import { DOCUMENTS_BUCKET, MAX_DOCUMENT_BYTES } from "./schemas";

// Envoi d'un PDF depuis le navigateur, en trois temps : le serveur contrôle
// la demande et signe l'envoi, le navigateur envoie le fichier directement au
// stockage, puis le serveur vérifie le fichier reçu et crée le document.

// Fichier refusé avant tout envoi : la raison, sinon null
export function pdfProblem(file: Pick<File, "name" | "size">): string | null {
  if (!/\.pdf$/i.test(file.name)) return "seuls les PDF et les photos sont acceptés";
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) {
    return "le fichier doit faire 10 Mo au maximum";
  }
  return null;
}

// Nom du document : celui du fichier, sans l'extension
export function documentNameOf(fileName: string) {
  return fileName.replace(/\.pdf$/i, "").trim().slice(0, 120) || "Document";
}

// Message de fin d'un envoi de plusieurs fichiers, réussi en tout ou partie
export function uploadSummary(added: number, lastError: string | null) {
  const addedText = added > 1 ? `${added} documents ajoutés` : "Document ajouté";
  if (!lastError) return { text: addedText, error: false };
  return { text: added > 0 ? `${addedText} · ${lastError}` : lastError, error: true };
}

// Envoie un fichier déjà accepté par pdfProblem. Renvoie l'erreur, sinon null.
// `base` : /api/cases/<id>/documents
export async function uploadDocument(
  base: string,
  file: File,
  folderId: string | null,
): Promise<string | null> {
  const name = documentNameOf(file.name);

  const step1 = await callApi<{ documentId: string; path: string; token: string }>(
    `${base}/upload-url`,
    { body: { name, originalFileName: file.name, sizeBytes: file.size } },
  );
  if (!step1.ok) return step1.error;

  const supabase = await loadClient();
  const { error: uploadError } = await supabase
    .storage.from(DOCUMENTS_BUCKET)
    .uploadToSignedUrl(step1.data.path, step1.data.token, file, {
      contentType: "application/pdf",
    });
  if (uploadError) return "l'envoi a échoué, réessayez";

  const step3 = await callApi(base, {
    body: { documentId: step1.data.documentId, name, originalFileName: file.name, folderId },
  });
  return step3.ok ? null : step3.error;
}
