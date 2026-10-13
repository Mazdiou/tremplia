import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  documentNameSchema,
} from "@/features/documents/schemas";
import { documentPath } from "@/features/documents/format";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { fail, ok, readJson, validationError } from "@/lib/api-errors";

// Étape 1 de l'envoi : le serveur contrôle la demande et renvoie une URL
// signée. Le navigateur envoie ensuite le PDF directement au stockage
// (la limite de corps de requête de Vercel est d'environ 4,5 Mo).
const schema = z.object({
  name: documentNameSchema,
  originalFileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .refine((n) => /\.pdf$/i.test(n), "Seuls les fichiers PDF sont acceptés"),
  sizeBytes: z
    .number()
    .int()
    .min(1, "Ce fichier est vide")
    .max(MAX_DOCUMENT_BYTES, "Le fichier dépasse 10 Mo"),
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

    const documentId = randomUUID();
    const path = documentPath(auth.agencyId, id, documentId);

    const { data, error } = await auth.admin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      console.error("[documents upload-url]", error?.message);
      return fail("Impossible de préparer l'envoi", 500);
    }

    return ok({ documentId, path: data.path, token: data.token });
  } catch (e) {
    console.error("[documents upload-url]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
