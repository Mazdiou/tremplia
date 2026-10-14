import { describe, expect, it } from "vitest";
import { moveProgramSchema, programLevelLabel, programSchema } from "./schemas";

describe("programSchema", () => {
  it("nettoie les champs et rend l'établissement facultatif", () => {
    const r = programSchema.parse({
      title: "  Licence Informatique ",
      level: "l3",
      city: " Lyon",
      institution: "   ",
    });
    expect(r).toEqual({ title: "Licence Informatique", level: "l3", city: "Lyon" });
  });

  it("refuse un intitulé vide, une ville vide et un niveau inconnu", () => {
    const r = programSchema.safeParse({ title: " ", level: "bac", city: "" });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path[0])).toEqual(["title", "level", "city"]);
  });
});

describe("moveProgramSchema", () => {
  it("n'accepte que -1 et +1", () => {
    expect(moveProgramSchema.safeParse({ direction: -1 }).success).toBe(true);
    expect(moveProgramSchema.safeParse({ direction: 2 }).success).toBe(false);
  });
});

describe("programLevelLabel", () => {
  it("affiche le libellé, ou la valeur brute si elle est inconnue", () => {
    expect(programLevelLabel("licence_pro")).toBe("Licence pro");
    expect(programLevelLabel("futur")).toBe("futur");
  });
});
