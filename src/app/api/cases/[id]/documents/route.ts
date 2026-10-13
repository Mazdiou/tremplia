import { z } from "zod";
import {
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  documentNameSchema,
} from "@/features/documents/schemas";
import { documentPath } from "@/features/documents/format";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { fail, ok, readJson, validationError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";

// Étape 2 de l'envoi : le serveur vérifie le fichier réellement envoyé
// (présent, taille, signature PDF) avant de créer la ligne.
const schema = z.object({
  documentId: z.string().uuid(),
  name: documentNameSchema,
  originalFileName: z.string().trim().min(1).max(255),
  // Dossier de rangement (absent ou null : « Sans dossier »)
  folderId: z.string().uuid().nullish(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;

    const body = await readJson(request);
    if (body === null) return fail("Requête invalide", 400);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { documentId, name, originalFileName, folderId } = parsed.data;

    // Le chemin est recalculé ici avec l'agence de la session
    const path = documentPath(auth.agencyId, id, documentId);
    const storage = auth.admin.storage.from(DOCUMENTS_BUCKET);

    const { data: blob, error: downloadError } = await storage.download(path);
    if (downloadError || !blob) {
      return fail("Le fichier n'a pas été reçu. Réessayez l'envoi.", 400);
    }

    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    const isPdf = new TextDecoder().decode(head) === "%PDF-";
    if (blob.size < 1 || blob.size > MAX_DOCUMENT_BYTES || !isPdf) {
      await storage.remove([path]);
      return fail(
        blob.size > MAX_DOCUMENT_BYTES
          ? "Le fichier dépasse 10 Mo"
          : "Ce fichier n'est pas un PDF valide",
        400,
      );
    }

    const { error: insertError } = await auth.admin.from("documents").insert({
      id: documentId,
      agency_id: auth.agencyId,
      case_id: id,
      name,
      original_file_name: originalFileName,
      storage_path: path,
      size_bytes: blob.size,
      uploaded_by: auth.caller.user.id,
      folder_id: folderId ?? null,
    });

    if (insertError) {
      // 23505 : déjà enregistré. Le fichier appartient alors à ce document :
      // on ne le supprime surtout pas.
      if (insertError.code === "23505") {
        return fail("Ce document est déjà ajouté", 409);
      }
      // 23503 : le dossier de rangement n'est pas un dossier de ce candidat
      if (insertError.code === "23503") {
        await storage.remove([path]);
        return fail("Dossier introuvable", 404);
      }
      console.error("[documents add]", insertError.message);
      await storage.remove([path]);
      return fail("Impossible d'ajouter le document", 500);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "document.added",
      targetType: "document",
      targetId: documentId,
      caseId: id,
      details: { name, size_bytes: blob.size },
    });

    return ok({ id: documentId }, 201);
  } catch (e) {
    console.error("[documents add]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
