import type { PlanEntry } from "./plan";
import { COPY_URL_BATCH } from "./schemas";

// Mise à jour de la copie dans un dossier de l'ordinateur (API File System
// Access de Chrome et Edge). Tremplia ne touche qu'aux fichiers qu'il a
// lui-même écrits : il les note dans un fichier caché à la racine de la copie
// (le « manifeste »). Un fichier ajouté à la main n'est jamais supprimé.
//
// Ordre : on retire d'abord ce qui n'a plus lieu d'être (document supprimé,
// renommé, candidat changé de groupe…), puis on écrit ce qui manque ou a
// changé. Le manifeste est réécrit à la fin, même après une erreur.

export const MANIFEST_NAME = ".tremplia-copie.json";

type Manifest = {
  version: 1;
  agencyId: string;
  // Chemin (séparateur « / ») → document copié et sa version
  files: Record<string, { id: string; caseId: string; v: string }>;
};

export type SyncResult = {
  copied: number;
  removed: number;
  unchanged: number;
  failed: number;
};

export class OtherAgencyError extends Error {
  constructor() {
    super("Ce dossier contient la copie d'une autre agence");
  }
}

// Les lots de liens signés restent petits : chaque lien expire après 5 minutes
const URL_BATCH = COPY_URL_BATCH;
const PARALLEL = 4;

const NOT_FOUND = new Set(["NotFoundError", "TypeMismatchError"]);
function isNotFound(e: unknown) {
  return e instanceof Error && NOT_FOUND.has(e.name);
}

function split(path: string) {
  const parts = path.split("/");
  return { dirs: parts.slice(0, -1), name: parts[parts.length - 1] };
}

// Accès aux sous-dossiers, mis en cache pendant une mise à jour
class Tree {
  private dirs = new Map<string, Promise<FileSystemDirectoryHandle>>();
  constructor(private root: FileSystemDirectoryHandle) {}

  dir(parts: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
    if (parts.length === 0) return Promise.resolve(this.root);
    const key = parts.join("/");
    const cached = this.dirs.get(key);
    if (cached) return cached;
    const p = this.dir(parts.slice(0, -1), create).then((parent) =>
      parent.getDirectoryHandle(parts[parts.length - 1], { create }),
    );
    // Un échec (dossier absent) n'est pas gardé : il pourra être créé ensuite
    p.catch(() => this.dirs.delete(key));
    this.dirs.set(key, p);
    return p;
  }

  forget(parts: string[]) {
    const key = parts.join("/");
    for (const k of [...this.dirs.keys()]) {
      if (k === key || k.startsWith(`${key}/`)) this.dirs.delete(k);
    }
  }

  async size(path: string): Promise<number | null> {
    const { dirs, name } = split(path);
    try {
      const dir = await this.dir(dirs, false);
      return (await (await dir.getFileHandle(name)).getFile()).size;
    } catch (e) {
      if (isNotFound(e)) return null;
      throw e;
    }
  }

  async write(path: string, data: Blob) {
    const { dirs, name } = split(path);
    const dir = await this.dir(dirs, true);
    const writable = await (await dir.getFileHandle(name, { create: true })).createWritable();
    try {
      await writable.write(data);
      await writable.close();
    } catch (e) {
      await writable.abort().catch(() => {});
      throw e;
    }
  }

  async remove(path: string) {
    const { dirs, name } = split(path);
    try {
      await (await this.dir(dirs, false)).removeEntry(name);
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }

  // Supprime le dossier s'il est vide (jamais la racine)
  async pruneIfEmpty(parts: string[]) {
    if (parts.length === 0) return;
    try {
      const dir = await this.dir(parts, false);
      if (!(await dir.keys().next()).done) return;
      const parent = await this.dir(parts.slice(0, -1), false);
      await parent.removeEntry(parts[parts.length - 1]);
      this.forget(parts);
    } catch (e) {
      if (!isNotFound(e)) throw e;
    }
  }
}

async function readManifest(root: FileSystemDirectoryHandle): Promise<Manifest | null> {
  try {
    const text = await (await (await root.getFileHandle(MANIFEST_NAME)).getFile()).text();
    const m = JSON.parse(text) as Manifest;
    if (m?.version !== 1 || typeof m.agencyId !== "string" || typeof m.files !== "object") {
      return null;
    }
    return m;
  } catch (e) {
    if (isNotFound(e) || e instanceof SyntaxError) return null;
    throw e;
  }
}

async function writeManifest(root: FileSystemDirectoryHandle, m: Manifest) {
  const writable = await (await root.getFileHandle(MANIFEST_NAME, { create: true })).createWritable();
  await writable.write(new Blob([JSON.stringify(m)], { type: "application/json" }));
  await writable.close();
}

// Agence déjà copiée dans ce dossier, ou null s'il n'a pas de manifeste
export async function copyOwner(root: FileSystemDirectoryHandle): Promise<string | null> {
  return (await readManifest(root))?.agencyId ?? null;
}

// Exécute les tâches avec au plus `limit` en parallèle
async function pool<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
}

export async function syncCopy(opts: {
  root: FileSystemDirectoryHandle;
  agencyId: string;
  plan: PlanEntry[];
  // Un seul candidat : les fichiers des autres ne sont pas touchés
  scopeCaseId?: string;
  // `total` : nombre de fichiers à télécharger dans cette mise à jour
  getUrls: (ids: string[], batch: { first: boolean; total: number }) => Promise<Map<string, string>>;
  fetchFile: (url: string) => Promise<Blob>;
  onProgress?: (done: number, total: number) => void;
}): Promise<SyncResult> {
  const { root, agencyId, scopeCaseId } = opts;
  const manifest = (await readManifest(root)) ?? { version: 1, agencyId, files: {} };
  if (manifest.agencyId !== agencyId) throw new OtherAgencyError();

  const inScope = (caseId: string) => !scopeCaseId || caseId === scopeCaseId;
  const plan = opts.plan.filter((e) => inScope(e.caseId));
  const planned = new Map(plan.map((e) => [e.path, e]));
  const tree = new Tree(root);
  const result: SyncResult = { copied: 0, removed: 0, unchanged: 0, failed: 0 };

  try {
    // 1. Retirer les fichiers qui n'ont plus lieu d'être
    const stale = Object.entries(manifest.files).filter(
      ([path, f]) => inScope(f.caseId) && !planned.has(path),
    );
    const touchedDirs = new Set<string>();
    for (const [path] of stale) {
      try {
        await tree.remove(path);
        delete manifest.files[path];
        result.removed += 1;
        const { dirs } = split(path);
        for (let i = dirs.length; i > 0; i--) touchedDirs.add(dirs.slice(0, i).join("/"));
      } catch {
        // Fichier ouvert dans un autre programme : on réessaiera la prochaine fois
        result.failed += 1;
      }
    }
    // Les plus profonds d'abord, pour remonter jusqu'au premier dossier non vide
    const byDepth = [...touchedDirs].sort((a, b) => b.split("/").length - a.split("/").length);
    for (const dir of byDepth) await tree.pruneIfEmpty(dir.split("/")).catch(() => {});

    // 2. Repérer ce qui manque ou a changé
    const toCopy: typeof plan = [];
    await pool(plan, PARALLEL * 4, async (e) => {
      const known = manifest.files[e.path];
      if (known && known.id === e.docId && known.v === e.version) {
        const size = await tree.size(e.path).catch(() => null);
        if (size === e.size) {
          result.unchanged += 1;
          return;
        }
      }
      toCopy.push(e);
    });
    toCopy.sort((a, b) => a.path.localeCompare(b.path));

    // 3. Télécharger et écrire, par lots
    let done = 0;
    opts.onProgress?.(0, toCopy.length);
    for (let i = 0; i < toCopy.length; i += URL_BATCH) {
      const batch = toCopy.slice(i, i + URL_BATCH);
      const urls = await opts.getUrls(
        batch.map((e) => e.docId),
        { first: i === 0, total: toCopy.length },
      );
      await pool(batch, PARALLEL, async (e) => {
        try {
          const url = urls.get(e.docId);
          if (!url) throw new Error("lien manquant");
          await tree.write(e.path, await opts.fetchFile(url));
          manifest.files[e.path] = { id: e.docId, caseId: e.caseId, v: e.version };
          result.copied += 1;
        } catch {
          result.failed += 1;
        }
        opts.onProgress?.(++done, toCopy.length);
      });
    }
  } finally {
    await writeManifest(root, manifest);
  }
  return result;
}
