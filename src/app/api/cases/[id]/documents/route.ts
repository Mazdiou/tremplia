import { z } from "zod";
import { ApiError, dbError, ok, parseBody, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { documentPath } from "@/features/documents/format";
import {
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  documentNameSchema,
} from "@/features/documents/schemas";

// Étape 2 de l'envoi : le serveur vérifie le fichier réellement envoyé
// (présent, taille, signature PDF) avant de créer la ligne.
const schema = z.object({
  documentId: z.string().uuid(),
  name: documentNameSchema,
  originalFileName: z.string().trim().min(1).max(255),
  // Dossier de rangement (absent ou null : « Sans dossier »)
  folderId: z.string().uuid().nullish(),
});

export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("documents add", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { documentId, name, originalFileName, folderId } = await parseBody(request, schema);

    // Le chemin est recalculé ici avec l'agence de la session
    const path = documentPath(auth.agencyId, id, documentId);
    const storage = auth.admin.storage.from(DOCUMENTS_BUCKET);

    const { data: blob, error: downloadError } = await storage.download(path);
    if (downloadError || !blob) {
      throw new ApiError(400, "Le fichier n'a pas été reçu. Réessayez l'envoi.");
    }

    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    const isPdf = new TextDecoder().decode(head) === "%PDF-";
    if (blob.size < 1 || blob.size > MAX_DOCUMENT_BYTES || !isPdf) {
      await storage.remove([path]);
      throw new ApiError(
        400,
        blob.size > MAX_DOCUMENT_BYTES
          ? "Le fichier dépasse 10 Mo"
          : "Ce fichier n'est pas un PDF valide",
      );
    }

    const { error } = await auth.admin.from("documents").insert({
      id: documentId,
      agency_id: auth.agencyId,
      case_id: id,
      name,
      original_file_name: originalFileName,
      storage_path: path,
      size_bytes: blob.size,
      uploaded_by: auth.member.userId,
      folder_id: folderId ?? null,
    });

    if (error) {
      // 23505 : déjà enregistré. Le fichier appartient alors à ce document :
      // on ne le supprime surtout pas.
      if (error.code !== "23505") await storage.remove([path]);
      throw dbError("documents add", error, {
        "23505": "Ce document est déjà ajouté",
        // Le dossier de rangement n'est pas un dossier de ce candidat
        "23503": "Dossier introuvable",
      });
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "document.added",
      targetType: "document",
      targetId: documentId,
      caseId: id,
      details: { size_bytes: blob.size, folder_id: folderId ?? null },
    });

    return ok({ id: documentId }, 201);
  });
}
