import { describe, expect, it } from "vitest";
import { replaceStagesSchema, stageNamesSchema } from "./schemas";
import {
  removalTargets,
  stageFilterOptions,
  stageKey,
  stageProgress,
  stagesOf,
  type CampaignStage,
} from "./stages";

const stage = (id: string, campaign_id: string, name: string, position: number): CampaignStage => ({
  id,
  campaign_id,
  name,
  position,
});

const STAGES = [
  stage("s3", "a", "Visa", 2),
  stage("s1", "a", "Constitution", 0),
  stage("s2", "a", "Entretien", 1),
  stage("t1", "b", "constitution ", 0),
  stage("t2", "b", "Départ", 1),
];

describe("étapes", () => {
  it("rend les étapes d'une campagne dans l'ordre", () => {
    expect(stagesOf(STAGES, "a").map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
    expect(stagesOf(STAGES, "z")).toEqual([]);
  });

  it("situe un dossier dans les étapes de sa campagne", () => {
    const ordered = stagesOf(STAGES, "a");
    expect(stageProgress(ordered, "s2")).toMatchObject({
      index: 1,
      total: 3,
      stage: { name: "Entretien" },
      next: { name: "Visa" },
    });
    expect(stageProgress(ordered, "s3")?.next).toBeNull();
    expect(stageProgress(ordered, null)).toBeNull();
    expect(stageProgress(ordered, "t1")).toBeNull();
  });

  it("propose chaque nom d'étape une seule fois au filtre", () => {
    expect(stageKey("  Entretien ")).toBe("entretien");
    expect(stageFilterOptions(STAGES, ["a", "b"])).toEqual([
      { key: "constitution", name: "Constitution" },
      { key: "entretien", name: "Entretien" },
      { key: "visa", name: "Visa" },
      { key: "départ", name: "Départ" },
    ]);
    expect(stageFilterOptions(STAGES, ["b"]).map((o) => o.name)).toEqual([
      "constitution ",
      "Départ",
    ]);
  });

  it("refuse deux étapes du même nom ou trop d'étapes", () => {
    expect(stageNamesSchema.safeParse(["Visa", "visa"]).success).toBe(false);
    expect(stageNamesSchema.safeParse(Array.from({ length: 16 }, (_, i) => `E${i}`)).success).toBe(
      false,
    );
    expect(
      replaceStagesSchema.safeParse({
        stages: [
          { id: null, name: "Visa" },
          { id: null, name: " VISA " },
        ],
      }).success,
    ).toBe(false);
    expect(
      replaceStagesSchema.safeParse({ stages: [{ id: null, name: "Visa" }] }).success,
    ).toBe(true);
  });
});

describe("étapes retirées", () => {
  it("envoie les dossiers à l'étape gardée précédente, sinon à la première", () => {
    // Avant : s1 s2 s3 s4 ; après : nouvelle, s3, s1 (s2 et s4 retirées)
    const targets = removalTargets(["s1", "s2", "s3", "s4"], [null, "s3", "s1"]);
    expect(targets.get("s2")).toBe(2); // s1 la précédait
    expect(targets.get("s4")).toBe(1); // s3 la précédait
    expect(targets.has("s1")).toBe(false);
    expect(removalTargets(["s1", "s2"], [null, "s2"]).get("s1")).toBe(0);
  });
});
