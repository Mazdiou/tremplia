import { z } from "zod";

// Règles partagées entre le navigateur et le serveur. La base impose aussi
// 10 000 caractères au plus (migration motivation_letters).
export const MAX_LETTER_LENGTH = 10_000;

// Texte simple, gardé tel quel (paragraphes compris) ; vide = lettre effacée
export const letterSchema = z.object({
  content: z
    .string()
    .max(MAX_LETTER_LENGTH, `La lettre ne peut pas dépasser ${MAX_LETTER_LENGTH} caractères`),
});
