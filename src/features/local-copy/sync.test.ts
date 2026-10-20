import { describe, expect, it } from "vitest";
import { asHandle, FakeDir } from "../../../test/fake-file-system";
import type { PlanEntry } from "./plan";
import { MANIFEST_NAME, OtherAgencyError, copyOwner, syncCopy } from "./sync";

// Contenu « téléchargé » : le texte du lien, pour vérifier ce qui est écrit
const content = (docId: string, v: string) => `${docId}@${v}`;

function entry(path: string, docId: string, caseId = "c1", v = "v1"): PlanEntry {
  return { path, docId, caseId, version: v, size: content(docId, v).length };
}

function run(root: FakeDir, plan: PlanEntry[], extra: { scopeCaseId?: string; agencyId?: string } = {}) {
  const versions = new Map(plan.map((e) => [e.docId, e.version]));
  const calls: { ids: string[]; first: boolean; total: number }[] = [];
  const promise = syncCopy({
    root: asHandle(root),
    agencyId: extra.agencyId ?? "agence-1",
    plan,
    scopeCaseId: extra.scopeCaseId,
    getUrls: async (ids, batch) => {
      calls.push({ ids, ...batch });
      return new Map(ids.map((id) => [id, `${id}@${versions.get(id)}`]));
    },
    fetchFile: async (url) => new Blob([url]),
  });
  return { promise, calls };
}

describe("syncCopy", () => {
  it("copie tout l'arbre au premier passage, puis ne retélécharge rien", async () => {
    const root = new FakeDir();
    const plan = [entry("CF/DAP/BENALI Sara/Bac.pdf", "bac"), entry("CF/DAP/BENALI Sara/Perso/Passeport.pdf", "pass")];

    const first = run(root, plan);
    expect(await first.promise).toEqual({ copied: 2, removed: 0, unchanged: 0, failed: 0 });
    expect(root.list()).toEqual(["CF/DAP/BENALI Sara/Bac.pdf", "CF/DAP/BENALI Sara/Perso/Passeport.pdf"]);
    expect(await root.read("CF/DAP/BENALI Sara/Bac.pdf")).toBe("bac@v1");
    expect(first.calls).toEqual([{ ids: ["bac", "pass"], first: true, total: 2 }]);

    const second = run(root, plan);
    expect(await second.promise).toEqual({ copied: 0, removed: 0, unchanged: 2, failed: 0 });
    expect(second.calls).toEqual([]);
  });

  it("réécrit un document modifié et recopie un fichier effacé à la main", async () => {
    const root = new FakeDir();
    await run(root, [entry("A/x.pdf", "x"), entry("A/y.pdf", "y")]).promise;
    await (await root.getDirectoryHandle("A")).removeEntry("y.pdf");

    const r = await run(root, [entry("A/x.pdf", "x", "c1", "v2"), entry("A/y.pdf", "y")]).promise;
    expect(r).toEqual({ copied: 2, removed: 0, unchanged: 0, failed: 0 });
    expect(await root.read("A/x.pdf")).toBe("x@v2");
    expect(await root.read("A/y.pdf")).toBe("y@v1");
  });

  it("retire un document supprimé ou déplacé et les dossiers devenus vides", async () => {
    const root = new FakeDir();
    await run(root, [entry("CF/DAP/BENALI Sara/Bac.pdf", "bac"), entry("CF/DAP/KACI Amine/CV.pdf", "cv", "c2")]).promise;

    // Sara passe de DAP à HORS DAP, Amine perd son CV
    const r = await run(root, [entry("CF/HORS DAP/BENALI Sara/Bac.pdf", "bac")]).promise;
    expect(r).toEqual({ copied: 1, removed: 2, unchanged: 0, failed: 0 });
    expect(root.list()).toEqual(["CF/HORS DAP/BENALI Sara/Bac.pdf"]);
    expect(root.dirs()).toEqual(["CF", "CF/HORS DAP", "CF/HORS DAP/BENALI Sara"]);
  });

  it("ne touche jamais aux fichiers ajoutés à la main", async () => {
    const root = new FakeDir();
    await run(root, [entry("CF/DAP/BENALI Sara/Bac.pdf", "bac")]).promise;
    await root.put("CF/DAP/BENALI Sara/notes perso.txt", "à moi");
    await root.put("Mes fichiers/photo.jpg", "à moi");

    const r = await run(root, []).promise;
    expect(r.removed).toBe(1);
    expect(root.list()).toEqual(["CF/DAP/BENALI Sara/notes perso.txt", "Mes fichiers/photo.jpg"]);
  });

  it("renommer un groupe en changeant seulement la casse : le nouveau nom apparaît", async () => {
    const root = new FakeDir();
    await run(root, [entry("CF/Dap/S/Bac.pdf", "bac")]).promise;
    const r = await run(root, [entry("CF/DAP/S/Bac.pdf", "bac")]).promise;
    expect(r).toEqual({ copied: 1, removed: 1, unchanged: 0, failed: 0 });
    expect(root.list()).toEqual(["CF/DAP/S/Bac.pdf"]);
  });

  it("limité à un candidat : les fichiers des autres ne bougent pas", async () => {
    const root = new FakeDir();
    await run(root, [entry("CF/G/A/a.pdf", "a", "c1"), entry("CF/G/B/b.pdf", "b", "c2")]).promise;

    // Le plan du candidat c1 ne contient plus rien ; c2 n'y figure pas
    const r = await run(root, [], { scopeCaseId: "c1" }).promise;
    expect(r).toEqual({ copied: 0, removed: 1, unchanged: 0, failed: 0 });
    expect(root.list()).toEqual(["CF/G/B/b.pdf"]);

    // Et un passage complet ensuite retrouve c2 intact
    const full = await run(root, [entry("CF/G/B/b.pdf", "b", "c2")]).promise;
    expect(full).toEqual({ copied: 0, removed: 0, unchanged: 1, failed: 0 });
  });

  it("un fichier ouvert dans un autre programme : compté en échec, réessayé ensuite", async () => {
    const root = new FakeDir();
    await run(root, [entry("A/x.pdf", "x"), entry("A/y.pdf", "y")]).promise;
    const dirA = await root.getDirectoryHandle("A");
    (await dirA.getFileHandle("x.pdf")).locked = true;

    const r = await run(root, [entry("A/x.pdf", "x", "c1", "v2"), entry("A/y.pdf", "y", "c1", "v2")]).promise;
    expect(r).toEqual({ copied: 1, removed: 0, unchanged: 0, failed: 1 });
    expect(await root.read("A/x.pdf")).toBe("x@v1");

    (await dirA.getFileHandle("x.pdf")).locked = false;
    const again = await run(root, [entry("A/x.pdf", "x", "c1", "v2"), entry("A/y.pdf", "y", "c1", "v2")]).promise;
    expect(again).toEqual({ copied: 1, removed: 0, unchanged: 1, failed: 0 });
  });

  it("un document sans lien de téléchargement est compté en échec", async () => {
    const root = new FakeDir();
    const r = await syncCopy({
      root: asHandle(root),
      agencyId: "agence-1",
      plan: [entry("A/x.pdf", "x")],
      getUrls: async () => new Map(),
      fetchFile: async () => new Blob([]),
    });
    expect(r).toEqual({ copied: 0, removed: 0, unchanged: 0, failed: 1 });
  });

  it("refuse le dossier de copie d'une autre agence, sans rien modifier", async () => {
    const root = new FakeDir();
    await run(root, [entry("A/x.pdf", "x")]).promise;
    expect(await copyOwner(asHandle(root))).toBe("agence-1");

    await expect(run(root, [], { agencyId: "agence-2" }).promise).rejects.toBeInstanceOf(OtherAgencyError);
    expect(root.list()).toEqual(["A/x.pdf"]);
    expect(await copyOwner(asHandle(new FakeDir()))).toBeNull();
  });

  it("une coupure réseau arrête la copie mais garde la trace de ce qui est écrit", async () => {
    const root = new FakeDir();
    const plan = Array.from({ length: 60 }, (_, i) => entry(`A/${String(i).padStart(2, "0")}.pdf`, `d${i}`));
    let calls = 0;
    await expect(
      syncCopy({
        root: asHandle(root),
        agencyId: "agence-1",
        plan,
        getUrls: async (ids) => {
          if (calls++ > 0) throw new Error("hors ligne");
          return new Map(ids.map((id) => [id, `${id}@v1`]));
        },
        fetchFile: async (url) => new Blob([url]),
      }),
    ).rejects.toThrow("hors ligne");
    expect(root.list()).toHaveLength(50);

    // La suite reprend sans retélécharger les 50 premiers
    const r = await run(root, plan).promise;
    expect(r).toEqual({ copied: 10, removed: 0, unchanged: 50, failed: 0 });
  });

  it("un manifeste illisible est ignoré", async () => {
    const root = new FakeDir();
    await root.put(MANIFEST_NAME, "{pas du json");
    const r = await run(root, [entry("A/x.pdf", "x")]).promise;
    expect(r.copied).toBe(1);
  });
});
