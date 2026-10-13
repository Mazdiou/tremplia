// Compare un dossier et ses nouvelles valeurs : ne renvoie que ce qui change.
// Fonction pure, sans accès à la base.

export type CaseEditable = {
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string;
  email: string | null;
  education_level: string;
  main_track: string | null;
  schools: boolean;
  scope: string;
  language_tests: string[];
  diplomas: string[];
  assigned_to: string | null;
};

const KEYS = [
  "first_name",
  "last_name",
  "birth_date",
  "phone",
  "email",
  "education_level",
  "main_track",
  "schools",
  "scope",
  "language_tests",
  "diplomas",
  "assigned_to",
] as const satisfies readonly (keyof CaseEditable)[];

// Pour ces champs, le journal garde le nom du champ mais jamais la valeur.
const PERSONAL = new Set<string>(["birth_date", "phone", "email"]);

const norm = (a: string[]) => [...new Set(a)].sort();

export function diffCase(current: CaseEditable, next: CaseEditable) {
  const patch: Record<string, unknown> = {};
  const fields: string[] = [];
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  for (const k of KEYS) {
    const a = current[k];
    const b = next[k];
    const same =
      Array.isArray(a) && Array.isArray(b)
        ? norm(a).join("|") === norm(b).join("|")
        : a === b;
    if (same) continue;

    patch[k] = Array.isArray(b) ? norm(b) : b;
    fields.push(k);
    if (!PERSONAL.has(k)) changes[k] = { from: a, to: b };
  }

  return { patch, fields, changes };
}
