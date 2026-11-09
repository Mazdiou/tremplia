import { describe, expect, it } from "vitest";
import { buildSteps, firstOpenStep, type OnboardingProgress } from "./steps";

const none: OnboardingProgress = {
  hasCampaign: false,
  hasCase: false,
  hasDocument: false,
  hasStudentAccess: false,
  hasTask: false,
  hasEmployee: false,
  hasSignupPage: false,
  latestCaseId: null,
};

describe("buildSteps", () => {
  it("nouvelle agence : rien de fait, la campagne d'abord", () => {
    const steps = buildSteps(none);
    expect(steps).toHaveLength(7);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(firstOpenStep(steps)).toBe("campagne");
  });

  it("sans campagne ni dossier, les étapes qui en dépendent n'ont pas de bouton", () => {
    const steps = buildSteps(none);
    const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
    expect(byId.dossier.action).toBeNull();
    expect(byId.inscription.action).toBeNull();
    expect(byId.document.action).toBeNull();
    expect(byId["espace-candidat"].action).toBeNull();
    expect(byId.tache.action).toBeNull();
    expect(byId.equipe.action?.href).toBe("/team");
  });

  it("les étapes d'un dossier mènent au dernier dossier créé", () => {
    const steps = buildSteps({ ...none, hasCampaign: true, hasCase: true, latestCaseId: "abc" });
    const byId = Object.fromEntries(steps.map((s) => [s.id, s]));
    expect(byId.document.action?.href).toBe("/cases/abc/documents");
    expect(byId.document.secondary?.href).toBe("/settings#ordinateur");
    expect(byId["espace-candidat"].action?.href).toBe("/cases/abc?ouvrir=espace-candidat");
    expect(byId.tache.action?.href).toBe("/cases/abc/tasks");
    expect(firstOpenStep(steps)).toBe("inscription");
  });

  it("la page d'inscription en ligne s'ouvre dans les réglages, une fois la campagne créée", () => {
    const steps = buildSteps({ ...none, hasCampaign: true });
    const inscription = steps.find((s) => s.id === "inscription");
    expect(inscription?.action).toEqual({ label: "Ouvrir ma page", href: "/settings#inscription" });
    expect(steps.map((s) => s.id).indexOf("inscription")).toBe(2);
  });

  it("tout est fait : plus d'étape ouverte", () => {
    const all = buildSteps({
      hasCampaign: true,
      hasCase: true,
      hasDocument: true,
      hasStudentAccess: true,
      hasTask: true,
      hasEmployee: true,
      hasSignupPage: true,
      latestCaseId: "abc",
    });
    expect(firstOpenStep(all)).toBeNull();
  });
});
