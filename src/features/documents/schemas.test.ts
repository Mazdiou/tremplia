import { describe, expect, it } from "vitest";
import { folderNameSchema } from "./schemas";

describe("folderNameSchema", () => {
  it("retire les espaces autour du nom", () => {
    expect(folderNameSchema.parse("  Banque  ")).toBe("Banque");
  });

  it("refuse un nom vide ou fait d'espaces", () => {
    expect(folderNameSchema.safeParse("").success).toBe(false);
    expect(folderNameSchema.safeParse("    ").success).toBe(false);
  });

  it("accepte 80 caractères, pas 81", () => {
    expect(folderNameSchema.safeParse("x".repeat(80)).success).toBe(true);
    expect(folderNameSchema.safeParse("x".repeat(81)).success).toBe(false);
  });
});
