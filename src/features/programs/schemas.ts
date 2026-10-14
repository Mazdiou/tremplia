import { z } from "zod";
import { optionalText, requiredText } from "@/lib/validation";

// Règles partagées entre le navigateur et le serveur. La base impose les
// mêmes valeurs et limites (migration case_programs).
export const MAX_PROGRAMS = 20;

// Dans l'ordre du parcours
export const PROGRAM_LEVELS = [
  "l1",
  "l2",
  "l3",
  "licence_pro",
  "m1",
  "m2",
  "bts",
  "but",
  "engineering",
  "doctorate",
  "other",
] as const;
export type ProgramLevel = (typeof PROGRAM_LEVELS)[number];

export const PROGRAM_LEVEL_LABELS: Record<ProgramLevel, string> = {
  l1: "L1",
  l2: "L2",
  l3: "L3",
  licence_pro: "Licence pro",
  m1: "M1",
  m2: "M2",
  bts: "BTS",
  but: "BUT",
  engineering: "Cycle ingénieur",
  doctorate: "Doctorat",
  other: "Autre",
};

// Un niveau inconnu s'affiche tel quel, sans faire planter la page
export function programLevelLabel(level: string) {
  return (PROGRAM_LEVEL_LABELS as Record<string, string>)[level] ?? level;
}

export const programSchema = z.object({
  title: requiredText(200, "Indiquez l'intitulé de la formation"),
  level: z.enum(PROGRAM_LEVELS, "Choisissez le niveau"),
  city: requiredText(100, "Indiquez la ville"),
  institution: optionalText(150),
});
export type ProgramInput = z.infer<typeof programSchema>;

export const moveProgramSchema = z.object({
  direction: z.union([z.literal(-1), z.literal(1)], "Direction invalide"),
});
