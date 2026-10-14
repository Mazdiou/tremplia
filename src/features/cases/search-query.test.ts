import { describe, expect, it } from "vitest";
import { parseSearchQuery } from "./search-query";

// Ce que fait l'opérateur ~ de PostgreSQL sur ces motifs simples
const matches = (pattern: string, phone: string) => new RegExp(pattern).test(phone);

describe("saisie de la recherche globale", () => {
  it("cherche par nom, sans accents ni majuscules", () => {
    expect(parseSearchQuery("  Éloïse DUPONT ")).toEqual({
      kind: "name",
      words: ["eloise", "dupont"],
    });
  });

  // Non-régression : un numéro saisi avec des espaces n'était pas retrouvé
  it("retrouve un numéro enregistré avec ou sans séparateurs", () => {
    const q = parseSearchQuery("0555123456");
    expect(q.kind).toBe("phone");
    if (q.kind !== "phone") return;
    expect(matches(q.pattern, "0555 12 34 56")).toBe(true);
    expect(matches(q.pattern, "0555-12-34-56")).toBe(true);
    expect(matches(q.pattern, "0555123456")).toBe(true);
    expect(matches(q.pattern, "0555 12 34 57")).toBe(false);
  });

  it("ignore les séparateurs saisis dans la recherche", () => {
    const q = parseSearchQuery("+213 (0) 555.12");
    expect(q.kind).toBe("phone");
    if (q.kind !== "phone") return;
    expect(matches(q.pattern, "+213 0 555 12 34 56")).toBe(true);
  });

  it("garde la recherche par nom sous 4 chiffres", () => {
    expect(parseSearchQuery("123").kind).toBe("name");
  });
});
