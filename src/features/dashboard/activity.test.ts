import { describe, expect, it } from "vitest";
import { groupActivity, type ActivityRow } from "./activity";

const row = (id: string, over: Partial<ActivityRow> = {}): ActivityRow => ({
  id,
  actor_id: "u1",
  action: "campaign.exported",
  target_type: "campaign",
  target_id: "c1",
  case_id: null,
  created_at: `2026-10-15T10:0${id}:00Z`,
  ...over,
});

describe("groupActivity", () => {
  it("regroupe les lignes identiques qui se suivent", () => {
    const groups = groupActivity([row("5"), row("4"), row("3"), row("2", { action: "case.updated", case_id: "k1" })], 6);
    expect(groups.map((g) => [g.id, g.count])).toEqual([
      ["5", 3],
      ["2", 1],
    ]);
  });

  it("ne regroupe pas un autre auteur ni un autre objet", () => {
    const groups = groupActivity([row("3"), row("2", { actor_id: "u2" }), row("1", { target_id: "c2" })], 6);
    expect(groups).toHaveLength(3);
  });

  it("regroupe la même action sur des objets différents d'un même dossier", () => {
    const doc = (id: string, target: string, caseId = "k1") =>
      row(id, { action: "document.added", target_type: "document", target_id: target, case_id: caseId });
    const groups = groupActivity([doc("4", "d4"), doc("3", "d3"), doc("2", "d2"), doc("1", "d1", "k2")], 6);
    expect(groups.map((g) => [g.id, g.count])).toEqual([
      ["4", 3],
      ["1", 1],
    ]);
  });

  it("ne regroupe pas des lignes séparées par une autre", () => {
    const groups = groupActivity([row("3"), row("2", { action: "case.updated" }), row("1")], 6);
    expect(groups.map((g) => g.count)).toEqual([1, 1, 1]);
  });

  it("s'arrête au nombre de groupes voulu, en finissant le dernier", () => {
    const groups = groupActivity([row("4", { actor_id: "u2" }), row("3"), row("2"), row("1", { actor_id: "u3" })], 2);
    expect(groups.map((g) => [g.id, g.count])).toEqual([
      ["4", 1],
      ["3", 2],
    ]);
  });
});
