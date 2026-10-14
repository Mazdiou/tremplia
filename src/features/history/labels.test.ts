import { describe, expect, it } from "vitest";
import { ACTIVITY_ACTIONS } from "@/lib/audit/actions";
import { activityActor, activityLabel } from "./labels";

describe("activityLabel", () => {
  it("a un libellé français pour chaque action, dans les deux vues", () => {
    for (const action of ACTIVITY_ACTIONS) {
      for (const scope of ["case", "agency"] as const) {
        const label = activityLabel(action, scope);
        expect(label).not.toBe("a effectué une action");
        expect(label).not.toContain(action);
      }
    }
  });

  // Non-régression : le tableau de bord affichait le code brut (« note.created »)
  it("n'affiche jamais le code brut d'une action inconnue", () => {
    expect(activityLabel("x.unknown", "agency")).toBe("a effectué une action");
    expect(activityLabel("", "case")).toBe("a effectué une action");
  });
});

describe("activityActor", () => {
  it("nomme le candidat pour ses actions, sinon le membre", () => {
    expect(activityActor("student.logged_in", null, "case")).toBe("Le candidat");
    expect(activityActor("student.logged_in", null, "agency")).toBe("Un candidat");
    expect(activityActor("note.created", "Yasmine K", "case")).toBe("Yasmine K");
    expect(activityActor("note.created", undefined, "agency")).toBe("Un ancien membre");
  });
});
