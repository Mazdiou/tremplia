import { describe, expect, it } from "vitest";
import {
  moveProgramSchema,
  programLevelLabel,
  programResult,
  programResultSchema,
  programResultsSummary,
  programSchema,
} from "./schemas";

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

describe("réponses des établissements", () => {
  it("compte chaque réponse, au singulier ou au pluriel", () => {
    expect(
      programResultsSummary(["accepted", "accepted", "rejected", "none", "waitlisted", "sent"]),
    ).toBe("2 acceptées · 1 en liste d'attente · 1 refusée · 1 envoyée · 1 sans réponse");
    expect(programResultsSummary(["none", "none"])).toBe("2 sans réponse");
    expect(programResultsSummary([])).toBe("");
  });

  it("traite une valeur inconnue comme « sans réponse »", () => {
    expect(programResult("maybe")).toBe("none");
    expect(programResult(null)).toBe("none");
    expect(programResult("accepted")).toBe("accepted");
  });

  it("n'accepte que les réponses connues", () => {
    expect(programResultSchema.safeParse({ result: "waitlisted" }).success).toBe(true);
    expect(programResultSchema.safeParse({ result: "maybe" }).success).toBe(false);
  });
});
