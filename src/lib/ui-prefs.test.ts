import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, sanitize } from "./ui-prefs";

describe("sanitize (mémoire de l'interface)", () => {
  it("revient aux valeurs par défaut pour une valeur absente ou illisible", () => {
    expect(sanitize(null)).toEqual(DEFAULT_PREFS);
    expect(sanitize("texte")).toEqual(DEFAULT_PREFS);
  });

  it("garde les réglages valides", () => {
    const prefs = sanitize({
      width: 300,
      showArchived: true,
      sortBy: "level",
      level: "l3",
      open: { a: true },
    });
    expect(prefs).toMatchObject({
      width: 300,
      showArchived: true,
      sortBy: "level",
      level: "l3",
      open: { a: true },
    });
  });

  it("borne la largeur du panneau", () => {
    expect(sanitize({ width: 10 }).width).toBe(220);
    expect(sanitize({ width: 9999 }).width).toBe(520);
  });

  // Non-régression : NaN est un « number » et donnait une largeur invalide
  it("ignore une largeur qui n'est pas un nombre fini", () => {
    expect(sanitize({ width: Number.NaN }).width).toBe(DEFAULT_PREFS.width);
  });

  it("n'accepte que des valeurs connues", () => {
    const prefs = sanitize({ sortBy: "date", collapsed: "oui", mine: 1 });
    expect(prefs.sortBy).toBe("name");
    expect(prefs.collapsed).toBe(false);
    expect(prefs.mine).toBe(false);
  });
});
