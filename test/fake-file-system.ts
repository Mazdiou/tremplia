// Faux dossier de l'ordinateur pour les tests : la partie de l'API File
// System Access dont la copie se sert, avec les mêmes erreurs que Chrome.

function domError(name: string) {
  const e = new Error(name);
  e.name = name;
  return e;
}

export class FakeFile {
  kind = "file" as const;
  locked = false;
  constructor(
    public name: string,
    public data: Blob = new Blob([]),
  ) {}
  async getFile() {
    return this.data;
  }
  async createWritable() {
    let next: Blob | null = null;
    return {
      write: async (b: Blob) => {
        next = b;
      },
      close: async () => {
        if (this.locked) throw domError("NoModificationAllowedError");
        if (next) this.data = next;
      },
      abort: async () => {},
    };
  }
}

export class FakeDir {
  kind = "directory" as const;
  children = new Map<string, FakeDir | FakeFile>();
  constructor(public name = "racine") {}

  // Windows : les noms ne tiennent pas compte de la casse
  private find(name: string) {
    for (const [k, v] of this.children) {
      if (k.toLowerCase() === name.toLowerCase()) return v;
    }
    return undefined;
  }

  async getDirectoryHandle(name: string, opts?: { create?: boolean }) {
    const found = this.find(name);
    if (found instanceof FakeDir) return found;
    if (found) throw domError("TypeMismatchError");
    if (!opts?.create) throw domError("NotFoundError");
    const dir = new FakeDir(name);
    this.children.set(name, dir);
    return dir;
  }

  async getFileHandle(name: string, opts?: { create?: boolean }) {
    const found = this.find(name);
    if (found instanceof FakeFile) return found;
    if (found) throw domError("TypeMismatchError");
    if (!opts?.create) throw domError("NotFoundError");
    const file = new FakeFile(name);
    this.children.set(name, file);
    return file;
  }

  async removeEntry(name: string) {
    const found = this.find(name);
    if (!found) throw domError("NotFoundError");
    if (found instanceof FakeFile && found.locked) throw domError("NoModificationAllowedError");
    if (found instanceof FakeDir && found.children.size > 0) {
      throw domError("InvalidModificationError");
    }
    this.children.delete(found.name);
  }

  async *keys() {
    for (const k of this.children.keys()) yield k;
  }

  // Tous les fichiers, par chemin « a/b/c.pdf » (sans le manifeste)
  list(prefix = ""): string[] {
    return [...this.children.values()]
      .flatMap((c) =>
        c instanceof FakeDir ? c.list(`${prefix}${c.name}/`) : [`${prefix}${c.name}`],
      )
      .filter((p) => !p.endsWith(".tremplia-copie.json"))
      .sort();
  }

  // Dossiers (vides compris)
  dirs(prefix = ""): string[] {
    return [...this.children.values()]
      .filter((c): c is FakeDir => c instanceof FakeDir)
      .flatMap((c) => [`${prefix}${c.name}`, ...c.dirs(`${prefix}${c.name}/`)])
      .sort();
  }

  private dirAt(parts: string[], create: boolean): Promise<FakeDir> {
    return parts.reduce<Promise<FakeDir>>(
      async (parent, name) => (await parent).getDirectoryHandle(name, { create }),
      Promise.resolve(this),
    );
  }

  async read(path: string) {
    const parts = path.split("/");
    const dir = await this.dirAt(parts.slice(0, -1), false);
    return (await dir.getFileHandle(parts[parts.length - 1])).data.text();
  }

  async put(path: string, text: string) {
    const parts = path.split("/");
    const dir = await this.dirAt(parts.slice(0, -1), true);
    const file = await dir.getFileHandle(parts[parts.length - 1], { create: true });
    file.data = new Blob([text]);
    return file;
  }
}

export function asHandle(dir: FakeDir) {
  return dir as unknown as FileSystemDirectoryHandle;
}
