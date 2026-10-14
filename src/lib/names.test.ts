import { describe, expect, it } from "vitest";
import { displayName, initialsOf, normalizeName } from "./names";

describe("noms", () => {
  it("compare sans casse, accents ni espaces multiples", () => {
    expect(normalizeName("  Éloïse   DUPONT ")).toBe(normalizeName("eloise dupont"));
  });

  it("donne les initiales, ou « ? » sans nom", () => {
    expect(initialsOf("sara", "Benali")).toBe("SB");
    expect(initialsOf("", "")).toBe("?");
  });

  it("affiche « NOM Prénom »", () => {
    expect(displayName("Sara", "Benali")).toBe("BENALI Sara");
  });
});
