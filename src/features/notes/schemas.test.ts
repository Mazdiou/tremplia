import { describe, expect, it } from "vitest";
import { MAX_NOTE_LENGTH, noteContentSchema } from "./schemas";

describe("noteContentSchema", () => {
  it("retire les espaces et sauts de ligne autour du texte", () => {
    expect(noteContentSchema.parse("\n  Appel à relancer  \n")).toBe(
      "Appel à relancer",
    );
  });

  it("garde les sauts de ligne à l'intérieur", () => {
    expect(noteContentSchema.parse("ligne 1\nligne 2")).toBe("ligne 1\nligne 2");
  });

  it("refuse une note vide ou faite d'espaces", () => {
    expect(noteContentSchema.safeParse("").success).toBe(false);
    expect(noteContentSchema.safeParse(" \n\t ").success).toBe(false);
  });

  it("accepte la longueur maximale, pas un caractère de plus", () => {
    expect(noteContentSchema.safeParse("x".repeat(MAX_NOTE_LENGTH)).success).toBe(true);
    expect(noteContentSchema.safeParse("x".repeat(MAX_NOTE_LENGTH + 1)).success).toBe(false);
  });
});
