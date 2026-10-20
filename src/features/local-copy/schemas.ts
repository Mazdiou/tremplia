import { z } from "zod";
import { optionalUuidSchema, uuidSchema } from "@/lib/validation";

// Liste à copier : toute l'agence, ou un seul candidat
export const copyPlanSchema = z.object({
  caseId: optionalUuidSchema,
});

// Liens de téléchargement d'un lot de documents. `logCount` : nombre total de
// documents de la mise à jour, inscrit au journal (envoyé avec le premier lot
// d'une mise à jour demandée par la personne ; une copie automatique, juste
// après un ajout, n'encombre pas le journal).
export const COPY_URL_BATCH = 50;
export const copyUrlsSchema = z.object({
  ids: z.array(uuidSchema).min(1).max(COPY_URL_BATCH),
  caseId: optionalUuidSchema,
  logCount: z.number().int().min(1).max(1_000_000).optional(),
});
