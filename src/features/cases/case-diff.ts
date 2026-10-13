import { CASE_FIELD_COLUMNS, type CaseFieldsRecord } from "./case-record";

// Compare un dossier et ses nouvelles valeurs : ne renvoie que ce qui change.
// Fonction pure, sans accès à la base.

// Seuls ces champs gardent leur ancienne et nouvelle valeur dans le journal.
// Pour tous les autres (identité, contact, parcours, projets), le journal ne
// garde que le nom du champ, jamais la valeur.
const LOGGABLE_VALUES = new Set<string>(["education_level"]);

// Texte comparable d'une valeur JSON, quel que soit l'ordre des clés des
// objets : la base (jsonb) ne rend pas les clés dans l'ordre où on les écrit.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export function diffCase(current: CaseFieldsRecord, next: CaseFieldsRecord) {
  const patch: Partial<CaseFieldsRecord> = {};
  const fields: string[] = [];
  const changes: Record<string, string | null> = {};

  for (const k of CASE_FIELD_COLUMNS) {
    // Les listes JSON se comparent par leur contenu (ordre des éléments compris)
    if (canonical(current[k]) === canonical(next[k])) continue;

    Object.assign(patch, { [k]: next[k] });
    fields.push(k);
    if (LOGGABLE_VALUES.has(k)) {
      changes[`${k}_from`] = current[k] as string;
      changes[`${k}_to`] = next[k] as string;
    }
  }

  return { patch, fields, changes };
}
