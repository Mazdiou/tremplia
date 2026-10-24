import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT,
  allowedWidget,
  applicableWidget,
  arrangeRows,
  layoutSchema,
  parseLayout,
} from "./widgets";

describe("parseLayout", () => {
  it("garde les widgets connus, dans l'ordre", () => {
    expect(
      parseLayout([
        { id: "tasks", size: "half" },
        { id: "todo", size: "full" },
      ]),
    ).toEqual([
      { id: "tasks", size: "half" },
      { id: "todo", size: "full" },
    ]);
  });

  it("ignore les widgets inconnus et en double, taille inconnue = pleine largeur", () => {
    expect(
      parseLayout([
        { id: "ancien", size: "half" },
        { id: "todo", size: "énorme" },
        { id: "todo", size: "half" },
        null,
      ]),
    ).toEqual([{ id: "todo", size: "full" }]);
  });

  it("autre chose qu'une liste : rien", () => {
    expect(parseLayout({ id: "todo" })).toBeNull();
    expect(parseLayout(null)).toBeNull();
  });
});

describe("layoutSchema", () => {
  it("accepte la disposition par défaut", () => {
    expect(layoutSchema.safeParse(DEFAULT_LAYOUT).success).toBe(true);
  });

  it("refuse un widget inconnu ou en double", () => {
    expect(layoutSchema.safeParse([{ id: "ancien", size: "full" }]).success).toBe(false);
    expect(
      layoutSchema.safeParse([
        { id: "todo", size: "full" },
        { id: "todo", size: "half" },
      ]).success,
    ).toBe(false);
  });
});

describe("droits et campagnes", () => {
  it("Paiements : patron ou droit « Voir la caisse » ; Activité : patron", () => {
    const employee = { isOwner: false, seesPayments: false };
    expect(allowedWidget("payments", employee)).toBe(false);
    expect(allowedWidget("payments", { ...employee, seesPayments: true })).toBe(true);
    expect(allowedWidget("activity", { isOwner: false, seesPayments: true })).toBe(false);
    expect(allowedWidget("activity", { isOwner: true, seesPayments: true })).toBe(true);
    expect(allowedWidget("todo", employee)).toBe(true);
  });

  it("Avancement et Échéances : une campagne ; Campagnes : plusieurs", () => {
    expect(applicableWidget("pipeline", 1)).toBe(true);
    expect(applicableWidget("pipeline", 3)).toBe(false);
    expect(applicableWidget("deadlines", 2)).toBe(false);
    expect(applicableWidget("campaigns", 1)).toBe(false);
    expect(applicableWidget("campaigns", 2)).toBe(true);
    expect(applicableWidget("results", 1)).toBe(true);
  });
});

describe("arrangeRows", () => {
  const wide = (sizes: ("half" | "full")[]) =>
    arrangeRows(sizes.map((size) => ({ size }))).map((r) => r.wide);

  it("deux demi-largeurs côte à côte", () => {
    expect(wide(["half", "half"])).toEqual([false, false]);
  });

  it("demi-largeur seule sur sa ligne : toute la largeur", () => {
    expect(wide(["half"])).toEqual([true]);
    expect(wide(["half", "full", "half", "half"])).toEqual([true, true, false, false]);
    expect(wide(["half", "half", "half"])).toEqual([false, false, true]);
  });

  it("l'ordre est conservé", () => {
    const rows = arrangeRows([
      { id: "a", size: "half" as const },
      { id: "b", size: "full" as const },
      { id: "c", size: "half" as const },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
