import { describe, expect, it } from "vitest";
import { ACTIVITY_ACTIONS } from "@/lib/audit/actions";
import { activityLabel } from "./labels";

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
