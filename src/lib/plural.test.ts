import { describe, expect, it } from "vitest";
import { plural, pluralWord } from "./plural";

describe("plural", () => {
  it("garde le singulier pour 0 et 1", () => {
    expect(plural(0, "dossier")).toBe("0 dossier");
    expect(plural(1, "dossier")).toBe("1 dossier");
    expect(plural(2, "dossier")).toBe("2 dossiers");
  });

  it("accepte un pluriel complet", () => {
    expect(plural(3, "message non lu", "messages non lus")).toBe("3 messages non lus");
    expect(pluralWord(1, "dossier actif", "dossiers actifs")).toBe("dossier actif");
  });
});
