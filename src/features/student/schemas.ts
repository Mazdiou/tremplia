import { z } from "zod";

export const studentLoginSchema = z.object({
  code: z.string().trim().min(1, "Saisissez votre code").max(40, "Code incorrect"),
});

export const studentAccessSchema = z.object({
  action: z.enum(["enable", "disable", "regenerate"], "Action invalide"),
});

// Accès vu par l'agence : code affiché (K7P4-9XQM), ou null si jamais ouvert
export type StudentAccess = { enabled: boolean; code: string } | null;
