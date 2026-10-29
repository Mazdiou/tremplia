import { callApi } from "@/lib/api-client";
import { loadClient } from "@/lib/supabase/lazy-client";
import { DOCUMENTS_BUCKET } from "@/features/documents/schemas";

// Envoi d'une pièce par le candidat, en trois temps comme les documents de
// l'agence : le serveur prépare l'envoi pour cette pièce, le navigateur
// envoie le PDF directement au stockage, puis le serveur vérifie le fichier
// reçu et le rattache à la pièce. Le PDF est déjà accepté par pdfProblem.
// Renvoie l'erreur à afficher, sinon null.
export async function sendStudentPiece(requestId: string, file: File): Promise<string | null> {
  const step1 = await callApi<{ documentId: string; path: string; token: string }>(
    "/api/student/documents/upload-url",
    { body: { requestId, originalFileName: file.name, sizeBytes: file.size } },
  );
  if (!step1.ok) return step1.error;

  const supabase = await loadClient();
  const { error: uploadError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .uploadToSignedUrl(step1.data.path, step1.data.token, file, {
      contentType: "application/pdf",
    });
  if (uploadError) return "L'envoi a échoué : vérifiez votre connexion et réessayez.";

  const step3 = await callApi("/api/student/documents", {
    body: { documentId: step1.data.documentId, originalFileName: file.name },
  });
  return step3.ok ? null : step3.error;
}
