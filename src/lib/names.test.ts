import { describe, expect, it } from "vitest";
import { displayName, normalizeName } from "./names";

describe("noms", () => {
  it("compare sans casse, accents ni espaces multiples", () => {
    expect(normalizeName("  Éloïse   DUPONT ")).toBe(normalizeName("eloise dupont"));
  });

  it("affiche « NOM Prénom »", () => {
    expect(displayName("Sara", "Benali")).toBe("BENALI Sara");
  });
});
