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
type ProgramLevel = (typeof PROGRAM_LEVELS)[number];

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

// Formation telle qu'affichée (agence et espace candidat)
export type ProgramItem = {
  id: string;
  title: string;
  level: string;
  city: string;
  institution: string | null;
  // Réponse de l'établissement (voir PROGRAM_RESULTS)
  result: string;
};

export const moveProgramSchema = z.object({
  direction: z.union([z.literal(-1), z.literal(1)], "Direction invalide"),
});

// Réponse de l'établissement, dans l'ordre du parcours de la candidature.
// La base impose les mêmes valeurs (migration case_program_results).
export const PROGRAM_RESULTS = ["none", "sent", "accepted", "waitlisted", "rejected"] as const;
export type ProgramResult = (typeof PROGRAM_RESULTS)[number];

export const PROGRAM_RESULT_LABELS: Record<ProgramResult, string> = {
  none: "Sans réponse",
  sent: "Candidature envoyée",
  accepted: "Acceptée",
  waitlisted: "Liste d'attente",
  rejected: "Refusée",
};

// Teinte de la pastille (voir StatusPill)
export const PROGRAM_RESULT_TONES = {
  none: "off",
  sent: "info",
  accepted: "ok",
  waitlisted: "warn",
  rejected: "bad",
} as const satisfies Record<ProgramResult, string>;

// Une valeur inconnue compte comme « sans réponse », sans faire planter la page
export function programResult(value: string | null | undefined): ProgramResult {
  return (PROGRAM_RESULTS as readonly string[]).includes(value ?? "")
    ? (value as ProgramResult)
    : "none";
}

// « 2 acceptées, 1 refusée, 1 sans réponse » (réponses présentes seulement)
export function programResultsSummary(results: string[]): string {
  const plural: Record<ProgramResult, [string, string]> = {
    accepted: ["acceptée", "acceptées"],
    waitlisted: ["en liste d'attente", "en liste d'attente"],
    rejected: ["refusée", "refusées"],
    sent: ["envoyée", "envoyées"],
    none: ["sans réponse", "sans réponse"],
  };
  const order: ProgramResult[] = ["accepted", "waitlisted", "rejected", "sent", "none"];
  return order
    .map((r) => {
      const n = results.filter((x) => programResult(x) === r).length;
      return n > 0 ? `${n} ${plural[r][n > 1 ? 1 : 0]}` : null;
    })
    .filter(Boolean)
    .join(", ");
}

export const programResultSchema = z.object({
  result: z.enum(PROGRAM_RESULTS, "Réponse invalide"),
});
