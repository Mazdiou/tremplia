import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ApiError, ok, parseBody, safely } from "@/lib/api-errors";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { documentPath } from "@/features/documents/format";
import {
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  documentNameSchema,
} from "@/features/documents/schemas";

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

export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("documents upload-url", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    await parseBody(request, schema);

    const documentId = randomUUID();
    const { data, error } = await auth.admin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(documentPath(auth.agencyId, id, documentId));
    if (error || !data) {
      console.error("[documents upload-url]", error?.name ?? "erreur");
      throw new ApiError(500, "Impossible de préparer l'envoi");
    }

    return ok({ documentId, path: data.path, token: data.token });
  });
}
