import { z } from "zod";

// Règles partagées entre le navigateur et le serveur (aucune donnée sensible).

export const DOCUMENTS_BUCKET = "case-documents";
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 Mo

export const documentNameSchema = z
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
  .min(1, "Saisissez un nom pour le dossier")
  .max(80, "Le nom ne peut pas dépasser 80 caractères");

// Chemin construit par le serveur seulement, jamais à partir d'un nom saisi.
export function documentPath(agencyId: string, caseId: string, docId: string) {
  return `${agencyId}/${caseId}/${docId}.pdf`;
}

export function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}
