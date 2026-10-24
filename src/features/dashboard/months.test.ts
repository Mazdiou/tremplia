import { describe, expect, it } from "vitest";
import { daysBetween, lastMonths } from "./months";

describe("lastMonths", () => {
  it("six mois jusqu'au mois en cours", () => {
    expect(lastMonths("2026-10-24", 6)).toEqual([
      "2026-05-01",
      "2026-06-01",
      "2026-07-01",
      "2026-08-01",
      "2026-09-01",
      "2026-10-01",
    ]);
  });

  it("passe d'une année à l'autre", () => {
    expect(lastMonths("2027-02-01", 3)).toEqual(["2026-12-01", "2027-01-01", "2027-02-01"]);
  });
});

describe("daysBetween", () => {
  it("jours entiers, changement d'heure compris", () => {
    expect(daysBetween("2026-10-01", "2026-10-24")).toBe(23);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-24")).toBe(0);
  });
});
