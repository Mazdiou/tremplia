import { describe, expect, it } from "vitest";
import { countCases, countCreatedLastWeek, sumStat, type CaseStatRow } from "./case-stats";

const row = (r: Partial<CaseStatRow>): CaseStatRow => ({
  campaign_id: "c1",
  status: "active",
  education_level: "l3",
  assigned_to: null,
  cases: 1,
  created_last_week: 0,
  remaining: 0,
  owing: 0,
  fee_unset: 0,
  ...r,
});

const rows = [
  row({ cases: 4, created_last_week: 2, assigned_to: "u1" }),
  row({ education_level: "m1", cases: 3 }),
  row({ status: "closed", cases: 2, created_last_week: 1 }),
  row({ status: "abandoned", cases: 1 }),
  row({ campaign_id: "c2", cases: 5, created_last_week: 5 }),
];

describe("countCases", () => {
  it("compte tous les dossiers sans filtre", () => {
    expect(countCases(rows)).toBe(15);
  });

  it("filtre par campagne, statut, niveau et responsable", () => {
    expect(countCases(rows, { campaignId: "c1", status: "active" })).toBe(7);
    expect(countCases(rows, { status: ["closed", "abandoned"] })).toBe(3);
    expect(countCases(rows, { status: "active", educationLevel: "l3" })).toBe(9);
    expect(countCases(rows, { status: "active", assignedTo: "u1" })).toBe(4);
    expect(countCases(rows, { campaignId: "absente" })).toBe(0);
  });
});

describe("countCreatedLastWeek", () => {
  it("additionne les dossiers récents, tous statuts", () => {
    expect(countCreatedLastWeek(rows)).toBe(8);
    expect(countCreatedLastWeek(rows, { campaignId: "c1" })).toBe(3);
  });
});

describe("sumStat", () => {
  it("additionne les montants et compteurs de paiement", () => {
    const pay = [
      row({ remaining: 90000, owing: 1 }),
      row({ remaining: 50000, owing: 2, fee_unset: 1 }),
      row({ campaign_id: "c2", remaining: 10000, owing: 1 }),
    ];
    expect(sumStat(pay, "remaining")).toBe(150000);
    expect(sumStat(pay, "owing", { campaignId: "c1" })).toBe(3);
    expect(sumStat(pay, "fee_unset")).toBe(1);
  });

  // La vue renvoie les sommes en bigint, que PostgREST transmet parfois en texte
  it("accepte une somme transmise en texte", () => {
    expect(sumStat([row({ remaining: "1500" as unknown as number })], "remaining")).toBe(1500);
  });
});
