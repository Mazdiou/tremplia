import { buildCampaignBranches, type TreeGroup } from "@/features/cases/tree";
import { archiveEntries, safeFileName } from "@/features/documents/archive";
import { displayName } from "@/lib/names";

// Copie des documents sur l'ordinateur : le même arbre que dans Tremplia.
//   Campagne / Groupe (ou « Non classés ») / NOM Prénom / [Dossier /] Document.pdf
// Un candidat rangé dans plusieurs groupes apparaît dans chacun, comme dans
// l'arbre. Seuls les dossiers en cours des campagnes en cours sont copiés
// (le serveur ne renvoie qu'eux).

export type PlanData = {
  campaigns: { id: string; name: string }[];
  groups: TreeGroup[];
  cases: {
    id: string;
    campaign_id: string;
    first_name: string;
    last_name: string;
    created_at: string;
  }[];
  caseGroups: { case_id: string; group_id: string }[];
  folders: { id: string; case_id: string; name: string }[];
  documents: {
    id: string;
    case_id: string;
    folder_id: string | null;
    name: string;
    created_at: string;
    updated_at: string;
    size_bytes: number;
  }[];
};

// Un fichier à avoir sur le disque. `version` change quand le document est
// modifié (renommé, déplacé…) : le fichier est alors réécrit.
export type PlanEntry = {
  path: string;
  docId: string;
  caseId: string;
  version: string;
  size: number;
};

// Les noms de dossiers restent courts : Windows limite la longueur d'un chemin
const SEGMENT_MAX = 80;

const collator = new Intl.Collator("fr", { sensitivity: "base" });

// Plus ancien d'abord : un nouveau venu prend le suffixe « (2) », les noms
// déjà copiés ne changent pas
function byAge(a: { created_at: string; id: string }, b: { created_at: string; id: string }) {
  return a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
}

// Nom unique dans son dossier, sans tenir compte de la casse (Windows) :
// « Nom », puis « Nom (2) »…
function uniqueIn(used: Set<string>, base: string) {
  let name = base;
  for (let n = 2; used.has(name.toLocaleLowerCase("fr")); n++) name = `${base} (${n})`;
  used.add(name.toLocaleLowerCase("fr"));
  return name;
}

export function buildCopyPlan(data: PlanData): PlanEntry[] {
  const foldersByCase = new Map<string, PlanData["folders"]>();
  for (const f of data.folders) {
    foldersByCase.set(f.case_id, [...(foldersByCase.get(f.case_id) ?? []), f]);
  }
  const docsByCase = new Map<string, PlanData["documents"]>();
  for (const d of [...data.documents].sort(byAge)) {
    docsByCase.set(d.case_id, [...(docsByCase.get(d.case_id) ?? []), d]);
  }

  // Chemin de chaque document à l'intérieur du dossier du candidat (mêmes
  // règles que l'archive ZIP)
  const insideCase = new Map<string, { doc: PlanData["documents"][number]; path: string }[]>();
  for (const [caseId, docs] of docsByCase) {
    const paths = new Map(
      archiveEntries(docs, foldersByCase.get(caseId) ?? []).map((e) => [e.id, e.path]),
    );
    insideCase.set(
      caseId,
      docs.map((doc) => ({ doc, path: paths.get(doc.id) as string })),
    );
  }

  const entries: PlanEntry[] = [];
  const campaignNames = new Set<string>();
  const campaigns = [...data.campaigns].sort(
    (a, b) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id),
  );
  const cases = [...data.cases].sort(byAge);

  for (const campaign of campaigns) {
    const campaignDir = uniqueIn(
      campaignNames,
      safeFileName(campaign.name, "Campagne", SEGMENT_MAX),
    );
    const groupNames = new Set<string>();
    for (const branch of buildCampaignBranches(campaign.id, data.groups, cases, data.caseGroups)) {
      const groupDir = uniqueIn(groupNames, safeFileName(branch.label, "Groupe", SEGMENT_MAX));
      const caseNames = new Set<string>();
      for (const c of branch.cases) {
        const caseDir = uniqueIn(
          caseNames,
          safeFileName(displayName(c.first_name, c.last_name), "Candidat", SEGMENT_MAX),
        );
        for (const { doc, path } of insideCase.get(c.id) ?? []) {
          entries.push({
            path: `${campaignDir}/${groupDir}/${caseDir}/${path}`,
            docId: doc.id,
            caseId: c.id,
            version: doc.updated_at,
            size: doc.size_bytes,
          });
        }
      }
    }
  }
  return entries;
}
