import { describe, expect, it } from "vitest";
import { asHandle, FakeDir } from "../../../test/fake-file-system";
import { copyRootLabel, openCopyRoot } from "./browser";
import { syncCopy } from "./sync";

describe("openCopyRoot", () => {
  it("un dossier vide est utilisé tel quel", async () => {
    const chosen = new FakeDir("Dossiers candidats");
    expect(await openCopyRoot(asHandle(chosen))).toBe(chosen);
    expect(await copyRootLabel(asHandle(chosen))).toBe("Dossiers candidats");
  });

  it("un dossier déjà rempli (le Bureau) reçoit un sous-dossier « Tremplia »", async () => {
    const bureau = new FakeDir("Bureau");
    await bureau.put("photo.jpg", "à moi");
    const root = await openCopyRoot(asHandle(bureau));
    expect(root.name).toBe("Tremplia");
    expect(bureau.children.has("Tremplia")).toBe(true);
    expect(await copyRootLabel(asHandle(bureau))).toBe("Bureau › Tremplia");
  });

  it("un dossier nommé « Tremplia » ou contenant déjà une copie est utilisé tel quel", async () => {
    const named = new FakeDir("tremplia");
    await named.put("a.txt", "x");
    expect(await openCopyRoot(asHandle(named))).toBe(named);

    const copy = new FakeDir("Copie");
    await syncCopy({
      root: asHandle(copy),
      agencyId: "a",
      plan: [],
      getUrls: async () => new Map(),
      fetchFile: async () => new Blob([]),
    });
    expect(await openCopyRoot(asHandle(copy))).toBe(copy);
  });
});
