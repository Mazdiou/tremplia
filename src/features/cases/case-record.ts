import type { CaseFields } from "./schemas";

// Passage entre les champs du formulaire (camelCase) et les colonnes de la
// table cases (snake_case, listes JSON décrites dans la migration).

export type DiplomaRecord = {
  type: string;
  title: string | null;
  year: number | null;
};

export type LanguageTestRecord = {
  test: string;
  other_name: string | null;
  result: string | null;
  date: string | null;
};

// Colonnes modifiables (même liste que assert_case_fields en SQL)
export type CaseFieldsRecord = {
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string;
  email: string | null;
  city: string | null;
  nationality: string | null;
  secondary_contact_name: string | null;
  secondary_contact_phone: string | null;
  education_level: string;
  current_field: string | null;
  current_institution: string | null;
  diplomas: DiplomaRecord[];
  language_tests: LanguageTestRecord[];
};

export const CASE_FIELD_COLUMNS = [
  "first_name",
  "last_name",
  "birth_date",
  "phone",
  "email",
  "city",
  "nationality",
  "secondary_contact_name",
  "secondary_contact_phone",
  "education_level",
  "current_field",
  "current_institution",
  "diplomas",
  "language_tests",
] as const satisfies readonly (keyof CaseFieldsRecord)[];

export function toCaseRecord(f: CaseFields): CaseFieldsRecord {
  return {
    first_name: f.firstName,
    last_name: f.lastName,
    birth_date: f.birthDate,
    phone: f.phone,
    email: f.email ?? null,
    city: f.city ?? null,
    nationality: f.nationality ?? null,
    secondary_contact_name: f.secondaryContactName ?? null,
    secondary_contact_phone: f.secondaryContactPhone ?? null,
    education_level: f.educationLevel,
    current_field: f.currentField ?? null,
    current_institution: f.currentInstitution ?? null,
    diplomas: f.diplomas.map((d) => ({
      type: d.type,
      title: d.title ?? null,
      year: d.year ?? null,
    })),
    language_tests: f.languageTests.map((t) => ({
      test: t.test,
      other_name: t.test === "other" ? (t.otherName ?? null) : null,
      result: t.result ?? null,
      date: t.date ?? null,
    })),
  };
}

// Valeurs de départ d'un formulaire (modification, ou import depuis une
// autre campagne) : chaînes vides plutôt que null.
export type CaseFieldsDraft = {
  firstName: string;
  lastName: string;
  birthDate: string;
  phone: string;
  email: string;
  city: string;
  nationality: string;
  secondaryContactName: string;
  secondaryContactPhone: string;
  educationLevel: string;
  currentField: string;
  currentInstitution: string;
  diplomas: { type: string; title: string; year: string }[];
  languageTests: { test: string; otherName: string; result: string; date: string }[];
};

// Champs envoyés à l'API : années en nombres, le reste tel quel (le serveur
// valide et nettoie, vide = absent).
export function caseFieldsPayload(f: CaseFieldsDraft) {
  return {
    ...f,
    diplomas: f.diplomas.map((d) => ({
      ...d,
      year: d.year.trim() === "" ? null : Number(d.year),
    })),
  };
}

// Valeurs vides d'un nouveau formulaire
export const EMPTY_CASE_FIELDS: CaseFieldsDraft = {
  firstName: "",
  lastName: "",
  birthDate: "",
  phone: "",
  email: "",
  city: "",
  nationality: "",
  secondaryContactName: "",
  secondaryContactPhone: "",
  educationLevel: "",
  currentField: "",
  currentInstitution: "",
  diplomas: [],
  languageTests: [],
};

// Dossier retrouvé dans une autre campagne pour préremplir un nouveau
// dossier. Comptes repris SANS mot de passe : il est à ressaisir.
export type ImportMatch = {
  id: string;
  status: string;
  fields: CaseFieldsDraft;
  externalAccounts: {
    platform: string;
    url: string;
    login: string;
    status: "existing" | "to_create";
  }[];
};

export function toCaseDraft(r: CaseFieldsRecord): CaseFieldsDraft {
  return {
    firstName: r.first_name,
    lastName: r.last_name,
    birthDate: r.birth_date,
    phone: r.phone,
    email: r.email ?? "",
    city: r.city ?? "",
    nationality: r.nationality ?? "",
    secondaryContactName: r.secondary_contact_name ?? "",
    secondaryContactPhone: r.secondary_contact_phone ?? "",
    educationLevel: r.education_level,
    currentField: r.current_field ?? "",
    currentInstitution: r.current_institution ?? "",
    diplomas: (r.diplomas ?? []).map((d) => ({
      type: d.type,
      title: d.title ?? "",
      year: d.year === null ? "" : String(d.year),
    })),
    languageTests: (r.language_tests ?? []).map((t) => ({
      test: t.test,
      otherName: t.other_name ?? "",
      result: t.result ?? "",
      date: t.date ?? "",
    })),
  };
}
