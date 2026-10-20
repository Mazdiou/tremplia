import { displayName } from "@/lib/names";

// Archive ZIP des documents d'un dossier : un sous-dossier par dossier de
// rangement, les documents sans dossier à la racine. Les noms viennent de
// l'agence : on retire ce que Windows ou macOS refusent dans un nom de
// fichier, et deux documents du même nom deviennent « Nom (2).pdf ».

const FORBIDDEN = /[\\/:*?"<>|\u0000-\u001f]/g;

// Noms réservés par Windows, même suivis d'une extension (« CON », « nul.pdf »)
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i;

export function safeFileName(name: string, fallback: string, max = 120) {
  const clean = name
    .replace(FORBIDDEN, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/, "");
  if (!clean) return fallback;
  return RESERVED.test(clean) ? `${clean}_` : clean;
}

export function archiveEntries(
  docs: { id: string; name: string; folder_id: string | null }[],
  folders: { id: string; name: string }[],
): { id: string; path: string }[] {
  const folderName = new Map(folders.map((f) => [f.id, safeFileName(f.name, "Dossier")]));
  const used = new Set<string>();
  return docs.map((d) => {
    const folder = d.folder_id ? folderName.get(d.folder_id) : undefined;
    const prefix = folder ? `${folder}/` : "";
    const base = safeFileName(d.name, "Document");
    let path = `${prefix}${base}.pdf`;
    for (let n = 2; used.has(path.toLocaleLowerCase("fr")); n++) {
      path = `${prefix}${base} (${n}).pdf`;
    }
    used.add(path.toLocaleLowerCase("fr"));
    return { id: d.id, path };
  });
}

// « Documents - BENALI Karim.zip »
export function archiveFileName(firstName: string, lastName: string) {
  return `${safeFileName(`Documents - ${displayName(firstName, lastName)}`, "Documents")}.zip`;
}
