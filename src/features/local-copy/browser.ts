import { copyOwner } from "./sync";

// Partie navigateur de la copie : choix du dossier, autorisation, et
// mémorisation du dossier choisi (IndexedDB, propre à ce navigateur et à
// chaque membre). Chrome et Edge sur ordinateur seulement.

// API File System Access : absente des types de TypeScript
type Permission = "granted" | "denied" | "prompt";
type PermissionHandle = FileSystemDirectoryHandle & {
  queryPermission?: (d: { mode: "readwrite" }) => Promise<Permission>;
  requestPermission?: (d: { mode: "readwrite" }) => Promise<Permission>;
};
type PickerWindow = Window & {
  showDirectoryPicker?: (o: {
    id?: string;
    mode?: "readwrite";
    startIn?: "desktop";
  }) => Promise<FileSystemDirectoryHandle>;
};

export function isLocalCopySupported() {
  return typeof window !== "undefined" && typeof (window as PickerWindow).showDirectoryPicker === "function";
}

// null si la personne ferme la fenêtre sans choisir
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (window as PickerWindow).showDirectoryPicker!({
      id: "tremplia-copie",
      mode: "readwrite",
      startIn: "desktop",
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return null;
    throw e;
  }
}

// `ask` : demande l'autorisation si besoin (seulement après un clic)
export async function folderPermission(handle: FileSystemDirectoryHandle, ask: boolean): Promise<Permission> {
  const h = handle as PermissionHandle;
  const state = (await h.queryPermission?.({ mode: "readwrite" })) ?? "granted";
  if (state === "granted" || !ask) return state;
  return (await h.requestPermission?.({ mode: "readwrite" })) ?? "denied";
}

export const COPY_FOLDER_NAME = "Tremplia";

// Racine de la copie : le dossier choisi s'il est vide, s'appelle
// « Tremplia » ou contient déjà une copie ; sinon (le Bureau, Documents…) un
// sous-dossier « Tremplia » créé dedans, pour ne jamais mélanger avec les
// fichiers qui s'y trouvent
export async function openCopyRoot(chosen: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (chosen.name.toLocaleLowerCase("fr") === COPY_FOLDER_NAME.toLocaleLowerCase("fr")) return chosen;
  if ((await copyOwner(chosen)) !== null) return chosen;
  if ((await chosen.keys().next()).done) return chosen;
  return chosen.getDirectoryHandle(COPY_FOLDER_NAME, { create: true });
}

// Chemin affiché : « Bureau › Tremplia »
export async function copyRootLabel(chosen: FileSystemDirectoryHandle) {
  const root = await openCopyRoot(chosen);
  return root === chosen ? chosen.name : `${chosen.name} › ${COPY_FOLDER_NAME}`;
}

// --- Réglage mémorisé -------------------------------------------------------

export type LastRun = {
  at: string;
  copied: number;
  removed: number;
  unchanged: number;
  failed: number;
};

export type LocalCopyConfig = {
  handle: FileSystemDirectoryHandle;
  // Copie automatique : à l'ouverture de Tremplia et à chaque changement
  // dans les documents d'un dossier
  auto: boolean;
  last: LastRun | null;
};

const DB_NAME = "tremplia-copie-locale";
const STORE = "reglages";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

// Clé : le membre (deux membres sur le même navigateur ont chacun leur dossier)
export async function loadConfig(userId: string): Promise<LocalCopyConfig | null> {
  try {
    const value = await withStore<LocalCopyConfig | undefined>("readonly", (s) => s.get(userId));
    return value?.handle ? value : null;
  } catch {
    return null;
  }
}

export async function saveConfig(userId: string, config: LocalCopyConfig) {
  await withStore("readwrite", (s) => s.put(config, userId));
}

export async function clearConfig(userId: string) {
  await withStore("readwrite", (s) => s.delete(userId));
}
