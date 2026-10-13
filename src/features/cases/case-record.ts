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
  study_project: string | null;
  career_project: string | null;
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
  "study_project",
  "career_project",
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
    study_project: f.studyProject ?? null,
    career_project: f.careerProject ?? null,
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
  studyProject: string;
  careerProject: string;
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
    studyProject: r.study_project ?? "",
    careerProject: r.career_project ?? "",
  };
}
