import { describe, expect, it } from "vitest";
import { CAMPAIGN_TEMPLATES, findCampaignTemplate } from "./index";
import { campaignTemplateSchema } from "./schema";

describe("modèles de campagne", () => {
  it("ont tous une clé unique", () => {
    const keys = CAMPAIGN_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it.each(CAMPAIGN_TEMPLATES.map((t) => [t.key, t] as const))(
    "%s est valide (dates réelles, libellés non vides, groupes uniques)",
    (_key, template) => {
      const parsed = campaignTemplateSchema.safeParse(template);
      expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    },
  );

  it("retrouve un modèle par sa clé, et rien pour une clé inconnue", () => {
    expect(findCampaignTemplate("campus-france-2026-2027")?.groups).toEqual([
      "DAP",
      "Hors-DAP",
      "École",
    ]);
    expect(findCampaignTemplate("inconnu")).toBeNull();
  });

  it("refuse une date impossible ou deux groupes du même nom", () => {
    const base = CAMPAIGN_TEMPLATES[0];
    expect(
      campaignTemplateSchema.safeParse({
        ...base,
        dates: [{ label: "x", date: "2026-02-30" }],
      }).success,
    ).toBe(false);
    expect(
      campaignTemplateSchema.safeParse({ ...base, groups: ["DAP", "dap"] }).success,
    ).toBe(false);
    expect(
      campaignTemplateSchema.safeParse({ ...base, stages: ["Visa", "VISA"] }).success,
    ).toBe(false);
  });
});
