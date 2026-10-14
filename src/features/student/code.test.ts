import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, CODE_LENGTH, formatCode, generateCode, normalizeCode } from "./code";

describe("generateCode", () => {
  it("produit 8 caractères de l'alphabet, différents à chaque appel", () => {
    const codes = new Set(Array.from({ length: 50 }, generateCode));
    expect(codes.size).toBe(50);
    for (const c of codes) {
      expect(c).toHaveLength(CODE_LENGTH);
      expect([...c].every((ch) => CODE_ALPHABET.includes(ch))).toBe(true);
    }
  });
});

describe("formatCode / normalizeCode", () => {
  it("affiche le code en deux blocs et accepte toute saisie équivalente", () => {
    expect(formatCode("K7P49XQM")).toBe("K7P4-9XQM");
    expect(normalizeCode("k7p4-9xqm")).toBe("K7P49XQM");
    expect(normalizeCode(" K7P4 9XQM ")).toBe("K7P49XQM");
  });

  it("refuse une longueur fausse et les caractères exclus", () => {
    expect(normalizeCode("K7P4-9XQ")).toBeNull();
    expect(normalizeCode("K7P4-9XQ0")).toBeNull();
    expect(normalizeCode("IIIIOOOO")).toBeNull();
  });
});
