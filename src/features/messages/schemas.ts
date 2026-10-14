import { z } from "zod";

// Règles partagées entre le navigateur et le serveur. La base impose aussi
// au moins un caractère visible et 2000 caractères au plus.
export const MAX_MESSAGE_LENGTH = 2000;

export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Écrivez votre message")
    .max(MAX_MESSAGE_LENGTH, `${MAX_MESSAGE_LENGTH} caractères au maximum`),
});

export type MessageItem = {
  id: string;
  sender: "student" | "agency";
  kind: "message" | "change_request";
  body: string;
  createdAt: string;
  // Membre de l'agence qui a écrit (null pour le candidat)
  authorName: string | null;
};
