import { z } from "zod";
import { uuidSchema } from "@/lib/validation";
import { fileSizeSchema, pdfFileNameSchema } from "@/features/documents/schemas";

// Pièces demandées au candidat. La base impose les mêmes limites (migration
// document_requests).

export const MAX_REQUESTS_PER_CASE = 30;

export const requestLabelSchema = z
  .string()
  .trim()
  .min(1, "Saisissez le nom de la pièce")
  .max(80, "Le nom ne peut pas dépasser 80 caractères");

// Corps des requêtes de l'agence

// Création ou modification ; folderId null : « Sans catégorie »
export const documentRequestSchema = z.object({
  label: requestLabelSchema,
  folderId: uuidSchema.nullable(),
});

// documentId : le document vu par le membre (refusé si le candidat l'a
// changé entre-temps)
export const acceptRequestSchema = z.object({
  accepted: z.boolean(),
  documentId: uuidSchema,
});

// Corps des requêtes du candidat

// Étape 1 de l'envoi : demande d'une URL signée pour une pièce
export const studentUploadSchema = z.object({
  requestId: uuidSchema,
  originalFileName: pdfFileNameSchema,
  sizeBytes: fileSizeSchema,
});

// Étape 2 de l'envoi : le fichier est arrivé
export const studentAddDocumentSchema = z.object({
  documentId: uuidSchema,
  originalFileName: z.string().trim().min(1).max(255),
});
