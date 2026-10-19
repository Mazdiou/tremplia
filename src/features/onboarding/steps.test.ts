import { describe, expect, it } from "vitest";
import { buildSteps, firstOpenStep, type OnboardingProgress } from "./steps";

const none: OnboardingProgress = {
  hasCampaign: false,
  hasCase: false,
  hasDocument: false,
  hasStudentAccess: false,
  hasTask: false,
  hasEmployee: false,
  latestCaseId: null,
};

describe("buildSteps", () => {
  it("nouvelle agence : rien de fait, la campagne d'abord", () => {
    const steps = buildSteps(none);
    expect(steps).toHaveLength(6);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(firstOpenStep(steps)).toBe("campagne");
  });

  it("sans campagne ni dossier, les étapes qui en dépendent n'ont pas de bouton", () => {
    const steps = buildSteps(none);
    const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
    expect(byId.dossier.action).toBeNull();
    expect(byId.document.action).toBeNull();
    expect(byId["espace-candidat"].action).toBeNull();
    expect(byId.tache.action).toBeNull();
    expect(byId.equipe.action?.href).toBe("/team");
  });

  it("les étapes d'un dossier mènent au dernier dossier créé", () => {
    const steps = buildSteps({ ...none, hasCampaign: true, hasCase: true, latestCaseId: "abc" });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
    expect(byId.document.action?.href).toBe("/cases/abc/documents");
    expect(byId["espace-candidat"].action?.href).toBe("/cases/abc?ouvrir=espace-candidat");
    expect(byId.tache.action?.href).toBe("/cases/abc/tasks");
    expect(firstOpenStep(steps)).toBe("document");
  });

  it("tout est fait : plus d'étape ouverte", () => {
    const all = buildSteps({
      hasCampaign: true,
      hasCase: true,
      hasDocument: true,
      hasStudentAccess: true,
      hasTask: true,
      hasEmployee: true,
      latestCaseId: "abc",
    });
    expect(firstOpenStep(all)).toBeNull();
  });
});
