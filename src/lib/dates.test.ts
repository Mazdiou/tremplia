import { describe, expect, it } from "vitest";
import { daysUntil, formatLongDate, todayInAppTimezone } from "./dates";

describe("dates de l'application", () => {
  it("donne la date du jour dans le fuseau de l'application", () => {
    // 23 h 30 UTC le 31 décembre = 0 h 30 le 1er janvier à Alger (UTC+1)
    expect(todayInAppTimezone(new Date("2026-12-31T23:30:00Z"))).toBe(
      "2027-01-01",
    );
  });

  it("compte les jours restants, négatifs une fois la date passée", () => {
    expect(daysUntil("2026-12-15", "2026-12-15")).toBe(0);
    expect(daysUntil("2026-12-15", "2026-12-01")).toBe(14);
    expect(daysUntil("2026-11-30", "2026-12-01")).toBe(-1);
  });

  it("formate une date seule sans la décaler d'un jour", () => {
    expect(formatLongDate("2026-10-01")).toBe("1 octobre 2026");
  });
});
