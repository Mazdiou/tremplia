import { describe, expect, it } from "vitest";
import { addDays, compareOpenTasks, dueLabel, dueState, quickDueDates } from "./due";

describe("dueState", () => {
  const today = "2026-10-21";
  it("classe les échéances", () => {
    expect(dueState(null, today)).toBe("none");
    expect(dueState("2026-10-20", today)).toBe("overdue");
    expect(dueState("2026-10-21", today)).toBe("today");
    expect(dueState("2026-10-28", today)).toBe("week");
    expect(dueState("2026-10-29", today)).toBe("later");
  });
});

describe("dueLabel", () => {
  const today = "2026-10-21"; // mercredi
  it("dit aujourd'hui, demain, hier", () => {
    expect(dueLabel("2026-10-21", today)).toBe("aujourd'hui");
    expect(dueLabel("2026-10-22", today)).toBe("demain");
    expect(dueLabel("2026-10-20", today)).toBe("hier");
  });
  it("donne le jour et la date, l'année si elle change", () => {
    expect(dueLabel("2026-10-26", today)).toBe("lun. 26/10");
    expect(dueLabel("2027-01-04", today)).toBe("04/01/2027");
  });
});

describe("addDays", () => {
  it("passe les mois et les années", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });
});

describe("quickDueDates", () => {
  it("propose aujourd'hui, demain, dans 3 jours et lundi prochain", () => {
    expect(quickDueDates("2026-10-21").map((q) => q.date)).toEqual([
      "2026-10-21",
      "2026-10-22",
      "2026-10-24",
      "2026-10-26",
    ]);
  });
  it("lundi prochain n'est jamais demain ni aujourd'hui", () => {
    // Dimanche : le lundi du lendemain est déjà « Demain »
    expect(quickDueDates("2026-10-25")[3].date).toBe("2026-11-02");
    // Lundi : le lundi suivant
    expect(quickDueDates("2026-10-26")[3].date).toBe("2026-11-02");
    // Samedi : dans deux jours
    expect(quickDueDates("2026-10-24")[3].date).toBe("2026-10-26");
  });
});

describe("compareOpenTasks", () => {
  it("trie par échéance, sans échéance à la fin, puis par création", () => {
    const tasks = [
      { id: "sans", dueDate: null, createdAt: "1" },
      { id: "tard", dueDate: "2026-11-01", createdAt: "1" },
      { id: "tot-2", dueDate: "2026-10-01", createdAt: "2" },
      { id: "tot-1", dueDate: "2026-10-01", createdAt: "1" },
    ];
    expect([...tasks].sort(compareOpenTasks).map((t) => t.id)).toEqual([
      "tot-1",
      "tot-2",
      "tard",
      "sans",
    ]);
  });
});
