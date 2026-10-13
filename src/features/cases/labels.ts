// Listes métier du dossier et leurs libellés français. Seule source de
// vérité : utilisées par zod, les formulaires, l'arbre et la fiche.

export const LEVEL_ORDER = ["terminale", "l1", "l2", "l3", "m1", "m2"] as const;
export type EducationLevel = (typeof LEVEL_ORDER)[number];

export const LEVEL_LABELS: Record<EducationLevel, string> = {
  terminale: "Terminale",
  l1: "L1",
  l2: "L2",
  l3: "L3",
  m1: "M1",
  m2: "M2",
};

export const CASE_STATUSES = ["active", "closed", "abandoned"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const STATUS_LABELS: Record<CaseStatus, string> = {
  active: "Actif",
  closed: "Clos",
  abandoned: "Abandonné",
};

export const SCOPES = ["application", "visa", "both"] as const;

export const SCOPE_LABELS: Record<(typeof SCOPES)[number], string> = {
  application: "Candidature",
  visa: "Visa",
  both: "Candidature et visa",
};

export const TRACKS = ["dap", "non_dap"] as const;

export const TRACK_LABELS: Record<(typeof TRACKS)[number], string> = {
  dap: "DAP",
  non_dap: "Hors-DAP",
};

export const LANGUAGE_TESTS = ["fr", "en"] as const;

export const LANGUAGE_TEST_LABELS: Record<
  (typeof LANGUAGE_TESTS)[number],
  string
> = {
  fr: "Test de français",
  en: "Test d'anglais",
};

export const DIPLOMAS = ["bac", "licence", "master"] as const;

export const DIPLOMA_LABELS: Record<(typeof DIPLOMAS)[number], string> = {
  bac: "Baccalauréat",
  licence: "Licence",
  master: "Master",
};

// Libellé d'une valeur venue de la base ; une valeur inconnue s'affiche telle quelle.
export function labelOf(labels: Record<string, string>, value: string) {
  return labels[value] ?? value;
}

export function procedureLabel(track: string | null, schools: boolean) {
  const t = track ? labelOf(TRACK_LABELS, track) : null;
  if (t && schools) return `${t} et écoles`;
  return t ?? (schools ? "Écoles" : "—");
}
