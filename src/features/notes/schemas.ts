import { z } from "zod";

// Règles partagées entre le navigateur et le serveur. La base impose aussi :
// au moins un caractère visible, 5000 caractères au maximum.
export const MAX_NOTE_LENGTH = 5000;

export const noteContentSchema = z
  .string()
  .trim()
  .min(1, "Écrivez votre note")
  .max(
    MAX_NOTE_LENGTH,
    `La note ne peut pas dépasser ${MAX_NOTE_LENGTH} caractères`,
  );

export const noteSchema = z.object({ content: noteContentSchema });
