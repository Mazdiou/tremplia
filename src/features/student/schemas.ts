import { z } from "zod";

export const studentLoginSchema = z.object({
  code: z.string().trim().min(1, "Saisissez votre code").max(40, "Code incorrect"),
});

export const studentAccessSchema = z.object({
  action: z.enum(["enable", "disable", "regenerate"], "Action invalide"),
});

// Accès vu par l'agence : code affiché (K7P4-9XQM), ou null si jamais ouvert
export type StudentAccess = { enabled: boolean; code: string } | null;

export const MAX_MESSAGE_LENGTH = 2000;

// Réponse du candidat : une demande de modification a toujours un message
// `fingerprint` : version du contenu affichée au candidat ; refusée si
// l'agence l'a modifiée entre-temps
const fingerprint = z.string().max(64);

export const studentReviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approved"), fingerprint }),
  z.object({
    decision: z.literal("changes_requested"),
    fingerprint,
    message: z
      .string()
      .trim()
      .min(1, "Expliquez ce que vous souhaitez modifier")
      .max(MAX_MESSAGE_LENGTH, `${MAX_MESSAGE_LENGTH} caractères au maximum`),
  }),
], "Réponse invalide");
export type StudentReviewInput = z.infer<typeof studentReviewSchema>;

export type ReviewStatus = "pending" | "approved" | "changes_requested";

// Réponse du candidat vue par l'agence (null : jamais répondu)
export type StudentReview = {
  status: ReviewStatus;
  respondedAt: string | null;
  lastRequest: { body: string; createdAt: string } | null;
} | null;
