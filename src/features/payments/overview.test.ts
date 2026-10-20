import { describe, expect, it } from "vitest";
import {
  balanceTotals,
  collectionTotals,
  firstDays,
  groupByDay,
  overviewFileName,
  overviewQuery,
  parseOverviewFilters,
  periodRange,
  sortBalances,
  type BalanceRow,
  type CollectionRow,
} from "./overview";

const C1 = "11111111-1111-4111-8111-111111111111";
const M1 = "22222222-2222-4222-8222-222222222222";
const known = { campaignIds: [C1], memberIds: [M1] };

describe("parseOverviewFilters", () => {
  it("valeurs par défaut", () => {
    expect(parseOverviewFilters({}, known)).toEqual({
      view: "encaissements",
      campaign: "",
      period: "mois",
      from: "",
      to: "",
      method: "",
      recordedBy: "",
      responsible: "",
      sort: "reste",
    });
  });

  it("garde les valeurs connues", () => {
    const f = parseOverviewFilters(
      { vue: "restes", campagne: C1, responsable: "aucun", tri: "ancien", moyen: "ccp", par: M1 },
      known,
    );
    expect(f).toMatchObject({
      view: "restes",
      campaign: C1,
      responsible: "aucun",
      sort: "ancien",
      method: "ccp",
      recordedBy: M1,
    });
    expect(parseOverviewFilters({ campagne: "toutes" }, known).campaign).toBe("toutes");
  });

  it("remplace les valeurs inconnues par la valeur par défaut", () => {
    const f = parseOverviewFilters(
      {
        vue: "x",
        campagne: "33333333-3333-4333-8333-333333333333",
        periode: "siecle",
        moyen: "bitcoin",
        par: "moi",
        responsable: C1,
        tri: "?",
      },
      known,
    );
    expect(f).toEqual(parseOverviewFilters({}, known));
  });

  it("dates au choix : valides, remises dans l'ordre, sinon ce mois-ci", () => {
    expect(
      parseOverviewFilters({ periode: "dates", du: "2026-10-15", au: "2026-10-01" }, known),
    ).toMatchObject({ period: "dates", from: "2026-10-01", to: "2026-10-15" });
    expect(
      parseOverviewFilters({ periode: "dates", du: "2026-02-30", au: "2026-03-01" }, known),
    ).toMatchObject({ period: "mois", from: "", to: "" });
    expect(parseOverviewFilters({ periode: "dates" }, known).period).toBe("mois");
    // Hors période « dates », du/au sont ignorés
    expect(
      parseOverviewFilters({ periode: "semaine", du: "2026-10-01", au: "2026-10-02" }, known),
    ).toMatchObject({ period: "semaine", from: "", to: "" });
  });

  it("prend la première valeur d'un paramètre répété", () => {
    expect(parseOverviewFilters({ vue: ["restes", "x"] }, known).view).toBe("restes");
  });
});

describe("overviewQuery", () => {
  it("rien pour les valeurs par défaut, et l'aller-retour garde les filtres", () => {
    expect(overviewQuery(parseOverviewFilters({}, known))).toBe("");
    const params = { periode: "dates", du: "2026-10-01", au: "2026-10-15", moyen: "cash", par: M1, campagne: C1 };
    const f = parseOverviewFilters(params, known);
    const again = parseOverviewFilters(Object.fromEntries(new URLSearchParams(overviewQuery(f))), known);
    expect(again).toEqual(f);
  });

  it("seulement les filtres de la vue affichée", () => {
    const f = parseOverviewFilters(
      { vue: "restes", moyen: "cash", periode: "annee", responsable: M1, tri: "nom" },
      known,
    );
    expect(overviewQuery(f)).toBe(`vue=restes&responsable=${M1}&tri=nom`);
  });
});

describe("periodRange", () => {
  const today = "2026-10-21"; // un mercredi
  const range = (period: string, from = "", to = "") =>
    periodRange({ period, from, to } as Parameters<typeof periodRange>[0], today);

  it("calcule chaque période", () => {
    expect(range("aujourdhui")).toEqual({ from: today, to: today, label: "Aujourd'hui" });
    expect(range("semaine")).toMatchObject({ from: "2026-10-19", to: today });
    expect(range("mois")).toEqual({ from: "2026-10-01", to: today, label: "Octobre 2026" });
    expect(range("mois-dernier")).toEqual({ from: "2026-09-01", to: "2026-09-30", label: "Septembre 2026" });
    expect(range("annee")).toEqual({ from: "2026-01-01", to: today, label: "Année 2026" });
    expect(range("tout")).toEqual({ from: null, to: null, label: "Depuis le début" });
    expect(range("dates", "2026-10-01", "2026-10-15").label).toBe("Du 01/10/2026 au 15/10/2026");
    expect(range("dates", "2026-10-03", "2026-10-03").label).toBe("Le 03/10/2026");
  });

  it("cas limites : lundi, dimanche, janvier", () => {
    expect(periodRange({ period: "semaine", from: "", to: "" }, "2026-10-19").from).toBe("2026-10-19");
    expect(periodRange({ period: "semaine", from: "", to: "" }, "2026-10-25").from).toBe("2026-10-19");
    expect(periodRange({ period: "mois-dernier", from: "", to: "" }, "2026-01-10")).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
      label: "Décembre 2025",
    });
    expect(periodRange({ period: "mois-dernier", from: "", to: "" }, "2028-03-05").to).toBe("2028-02-29");
  });
});

const pay = (p: Partial<CollectionRow>): CollectionRow => ({
  id: "p",
  caseId: "c",
  candidate: "BENALI Asma",
  campaign: "Campus France",
  amount: 1000,
  paidOn: "2026-10-20",
  method: "cash",
  note: null,
  recordedBy: "Patron",
  cancelReason: null,
  ...p,
});

describe("collectionTotals", () => {
  it("additionne par moyen, sans les annulés", () => {
    const t = collectionTotals([
      pay({ amount: 5000 }),
      pay({ amount: 2000, method: "ccp" }),
      pay({ amount: 9000, cancelReason: "doublon" }),
      pay({ amount: 300, method: "cheque" }),
    ]);
    expect(t.total).toBe(7300);
    expect(t.count).toBe(3);
    expect(t.cancelledCount).toBe(1);
    expect(t.byMethod.map((m) => [m.method, m.amount, m.count])).toEqual([
      ["cash", 5000, 1],
      ["ccp", 2000, 1],
      ["card", 0, 0],
      ["cheque", 300, 1],
    ]);
    expect(t.byMethod[3].label).toBe("Chèque");
  });
});

describe("groupByDay", () => {
  it("un groupe par jour, total hors annulés", () => {
    const days = groupByDay([
      pay({ id: "a", paidOn: "2026-10-20", amount: 100 }),
      pay({ id: "b", paidOn: "2026-10-20", amount: 50, cancelReason: "x" }),
      pay({ id: "c", paidOn: "2026-10-18", amount: 70 }),
    ]);
    expect(days.map((d) => [d.day, d.total, d.rows.length])).toEqual([
      ["2026-10-20", 100, 2],
      ["2026-10-18", 70, 1],
    ]);
  });
});

describe("firstDays", () => {
  it("des jours entiers, au moins le premier", () => {
    const days = groupByDay([
      pay({ id: "a", paidOn: "2026-10-20" }),
      pay({ id: "b", paidOn: "2026-10-20" }),
      pay({ id: "c", paidOn: "2026-10-19" }),
      pay({ id: "d", paidOn: "2026-10-18" }),
    ]);
    expect(firstDays(days, 3)).toMatchObject({ rows: 3 });
    expect(firstDays(days, 3).days.map((d) => d.day)).toEqual(["2026-10-20", "2026-10-19"]);
    expect(firstDays(days, 1)).toMatchObject({ rows: 2 });
    expect(firstDays(days, 10).rows).toBe(4);
  });
});

const owe = (b: Partial<BalanceRow>): BalanceRow => ({
  caseId: "c",
  candidate: "BENALI Asma",
  firstName: "Asma",
  phone: null,
  campaign: "Campus France",
  responsible: null,
  agreed: 100,
  paid: 0,
  remaining: 100,
  lastPaidOn: null,
  ...b,
});

describe("sortBalances", () => {
  const rows = [
    owe({ caseId: "a", candidate: "ZERROUK Ali", remaining: 50, paid: 50, lastPaidOn: "2026-10-01" }),
    owe({ caseId: "b", candidate: "AMRANI Sara", remaining: 80, paid: 20, lastPaidOn: "2026-09-01" }),
    owe({ caseId: "c", candidate: "BENALI Asma", remaining: 30 }),
    owe({ caseId: "d", candidate: "ÉLIAS Nour", remaining: 90 }),
  ];
  const ids = (s: Parameters<typeof sortBalances>[1]) => sortBalances(rows, s).map((r) => r.caseId);

  it("par reste, par ancienneté du dernier paiement, par nom", () => {
    expect(ids("reste")).toEqual(["d", "b", "a", "c"]);
    expect(ids("ancien")).toEqual(["d", "c", "b", "a"]);
    expect(ids("nom")).toEqual(["b", "c", "d", "a"]);
  });

  it("totaux", () => {
    expect(balanceTotals(rows)).toEqual({ remaining: 250, cases: 4, neverPaid: 2 });
  });
});

describe("overviewFileName", () => {
  it("nom lisible, sans caractère interdit", () => {
    expect(overviewFileName("encaissements", "Octobre 2026", "2026-10-21")).toBe(
      "Encaissements - Octobre 2026.xlsx",
    );
    expect(overviewFileName("encaissements", "Du 01/10/2026 au 15/10/2026", "2026-10-21")).toBe(
      "Encaissements - Du 01-10-2026 au 15-10-2026.xlsx",
    );
    expect(overviewFileName("restes", "", "2026-10-21")).toBe("Restes à payer - 21-10-2026.xlsx");
  });
});
