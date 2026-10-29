import { z } from "zod";
import { uuidSchema } from "@/lib/validation";

// Règles partagées entre le navigateur et le serveur (aucune donnée sensible).

export const DOCUMENTS_BUCKET = "case-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 Mo

const documentNameSchema = z
  .string()
  .trim()
  .min(1, "Saisissez un nom pour le document")
  .max(120, "Le nom ne peut pas dépasser 120 caractères");

// Dossiers de rangement des documents (un seul niveau, voir la migration
// document_folders). La base impose aussi : nom sans espace autour, unique
// par dossier candidat (majuscules ignorées).
export const MAX_FOLDERS_PER_CASE = 50;

export const folderNameSchema = z
  .string()
  .trim()
  .min(1, "Saisissez un nom pour la catégorie")
  .max(80, "Le nom ne peut pas dépasser 80 caractères");

// Nom et taille du fichier annoncés avant l'envoi (le fichier reçu est
// revérifié par le serveur)
export const pdfFileNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine((n) => /\.pdf$/i.test(n), "Seuls les fichiers PDF sont acceptés");

export const fileSizeSchema = z
  .number()
  .int()
  .min(1, "Ce fichier est vide")
  .max(MAX_DOCUMENT_BYTES, "Le fichier dépasse 10 Mo");

// Corps des requêtes

// Étape 1 de l'envoi : demande d'une URL signée
export const uploadRequestSchema = z.object({
  name: documentNameSchema,
  originalFileName: pdfFileNameSchema,
  sizeBytes: fileSizeSchema,
});

// Étape 2 de l'envoi : enregistrement du fichier reçu
export const addDocumentSchema = z.object({
  documentId: uuidSchema,
  name: documentNameSchema,
  originalFileName: z.string().trim().min(1).max(255),
  // Dossier de rangement (absent ou null : « Sans catégorie »)
  folderId: uuidSchema.nullish(),
});

export const renameDocumentSchema = z.object({ name: documentNameSchema });

// folderId null : « Sans catégorie »
export const moveDocumentSchema = z.object({ folderId: uuidSchema.nullable() });

export const lockDocumentSchema = z.object({ locked: z.boolean() });

export const folderSchema = z.object({ name: folderNameSchema });
