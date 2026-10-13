// Listes métier du dossier et leurs libellés français. Seule source de
// vérité : utilisées par zod, les formulaires, l'arbre, la fiche et le tri.
// Les valeurs sont aussi imposées par la base (migration cases).

// Dans l'ordre du parcours (le tri par niveau suit cet ordre)
export const EDUCATION_LEVELS = [
  "terminale",
  "l1",
  "l2",
  "bac_plus_2",
  "l3",
  "m1",
  "m2",
  "doctorate",
  "other",
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const EDUCATION_LEVEL_LABELS: Record<EducationLevel, string> = {
  terminale: "Terminale",
  l1: "L1",
  l2: "L2",
  bac_plus_2: "Bac+2 (BTS, DUT…)",
  l3: "L3",
  m1: "M1",
  m2: "M2",
  doctorate: "Doctorat",
  other: "Autre",
};

export const CASE_STATUSES = ["active", "closed", "abandoned"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const STATUS_LABELS: Record<CaseStatus, string> = {
  active: "Actif",
  closed: "Clos",
  abandoned: "Abandonné",
};

export const DIPLOMA_TYPES = [
  "baccalaureate",
  "license",
  "master",
  "doctorate",
  "other",
] as const;
export type DiplomaType = (typeof DIPLOMA_TYPES)[number];

export const DIPLOMA_TYPE_LABELS: Record<DiplomaType, string> = {
  baccalaureate: "Baccalauréat",
  license: "Licence",
  master: "Master",
  doctorate: "Doctorat",
  other: "Autre",
};

export const LANGUAGE_TESTS = ["tcf", "delf", "dalf", "ielts", "toefl", "other"] as const;
export type LanguageTest = (typeof LANGUAGE_TESTS)[number];

export const LANGUAGE_TEST_LABELS: Record<LanguageTest, string> = {
  tcf: "TCF",
  delf: "DELF",
  dalf: "DALF",
  ielts: "IELTS",
  toefl: "TOEFL",
  other: "Autre",
};

export const EXTERNAL_ACCOUNT_STATUSES = ["existing", "to_create"] as const;
export type ExternalAccountStatus = (typeof EXTERNAL_ACCOUNT_STATUSES)[number];

export const EXTERNAL_ACCOUNT_STATUS_LABELS: Record<ExternalAccountStatus, string> = {
  existing: "Compte existant",
  to_create: "À créer",
};

// Limites partagées avec la base
export const MAX_DIPLOMAS = 10;
export const MAX_LANGUAGE_TESTS = 10;
export const MAX_EXTERNAL_ACCOUNTS = 10;

// Libellé d'une valeur venue de la base ; une valeur inconnue s'affiche telle quelle.
export function labelOf(labels: Record<string, string>, value: string) {
  return labels[value] ?? value;
}

// Rang dans le parcours, pour trier ; une valeur inconnue passe à la fin
export function educationRank(level: string) {
  const i = (EDUCATION_LEVELS as readonly string[]).indexOf(level);
  return i === -1 ? EDUCATION_LEVELS.length : i;
}
