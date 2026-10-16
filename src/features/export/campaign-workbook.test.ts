import { describe, expect, it } from "vitest";
import {
  campaignWorkbook,
  diplomasSummary,
  exportFileName,
  languageTestsSummary,
  type ExportCase,
} from "./campaign-workbook";

function aCase(over: Partial<ExportCase>): ExportCase {
  return {
    id: "c1",
    first_name: "Sara",
    last_name: "Benali",
    birth_date: "2004-05-02",
    phone: "0550 00 00 00",
    email: null,
    city: null,
    nationality: null,
    secondary_contact_name: null,
    secondary_contact_phone: null,
    education_level: "l3",
    current_field: null,
    current_institution: null,
    diplomas: [],
    language_tests: [],
    status: "active",
    assigned_to: null,
    created_at: "2026-10-14T23:30:00Z",
    agreed_amount: null,
    paid_amount: 0,
    remaining_amount: null,
    stage_id: null,
    ...over,
  };
}

describe("résumés", () => {
  it("diplômes", () => {
    expect(
      diplomasSummary([
        { type: "license", title: "Informatique", year: 2025 },
        { type: "baccalaureate", title: null, year: null },
      ]),
    ).toBe("Licence – Informatique (2025) ; Baccalauréat");
  });
  it("tests de langue", () => {
    expect(
      languageTestsSummary([
        { test: "tcf", other_name: null, result: "B2", date: "2026-03-12" },
        { test: "other", other_name: "Goethe", result: null, date: null },
      ]),
    ).toBe("TCF B2 (12/03/2026) ; Goethe");
  });
});

describe("campaignWorkbook", () => {
  const [dossiers, formations, paiements] = campaignWorkbook({
    cases: [
      aCase({ id: "c2", first_name: "Amine", last_name: "Zerrouki", agreed_amount: 100000, paid_amount: 40000, remaining_amount: 60000, assigned_to: "u1", stage_id: "s2" }),
      aCase({ id: "c1" }),
    ],
    groups: [
      { id: "g1", name: "Groupe A" },
      { id: "g2", name: "Groupe B" },
    ],
    stages: [
      { id: "s1", name: "Constitution du dossier" },
      { id: "s2", name: "Entretien" },
    ],
    caseGroups: [
      { case_id: "c2", group_id: "g2" },
      { case_id: "c2", group_id: "g1" },
    ],
    members: [{ id: "u1", first_name: "Nadia", last_name: "Haddad" }],
    programs: [
      { case_id: "c2", position: 2, title: "Master IA", level: "m1", city: "Lyon", institution: null, result: "accepted" },
      { case_id: "c2", position: 1, title: "Master Data", level: "m1", city: "Paris", institution: null, result: null },
      { case_id: "autre", position: 1, title: "Hors campagne", level: "m1", city: "Nice", institution: null, result: null },
    ],
    payments: [
      { case_id: "c2", amount: 40000, paid_on: "2026-10-01", method: "cash", note: null, created_by: "u1", cancelled_at: null, cancel_reason: null },
      { case_id: "c2", amount: 5000, paid_on: "2026-09-01", method: "ccp", note: null, created_by: "u1", cancelled_at: "2026-09-02T10:00:00Z", cancel_reason: "Erreur" },
    ],
  });

  it("trie les dossiers par nom et résume leur suivi", () => {
    expect(dossiers.rows.map((r) => r[0])).toEqual(["BENALI", "ZERROUKI"]);
    const z = dossiers.rows[1];
    const col = (h: string) => z[dossiers.columns.findIndex((c) => c.header === h)];
    expect(col("Groupes")).toBe("Groupe A, Groupe B");
    expect(col("Responsable")).toBe("HADDAD Nadia");
    expect(col("Niveau")).toBe("L3");
    expect(col("Étape")).toBe("2. Entretien");
    expect(col("Formations")).toBe(2);
    expect(col("Réponses")).toBe("1 acceptée · 1 sans réponse");
    expect([col("Montant convenu"), col("Payé"), col("Reste à payer")]).toEqual([100000, 40000, 60000]);
  });

  it("date de création dans le fuseau de l'agence", () => {
    const b = dossiers.rows[0];
    expect(b[dossiers.columns.findIndex((c) => c.header === "Créé le")]).toBe("2026-10-15");
    // Pas de montant convenu : rien dans « Payé »
    expect(b[dossiers.columns.findIndex((c) => c.header === "Payé")]).toBeNull();
  });

  it("ne contient aucun compte externe", () => {
    const headers = dossiers.columns.map((c) => c.header.toLowerCase()).join(" ");
    expect(headers).not.toMatch(/mot de passe|identifiant|compte/);
  });

  it("formations dans l'ordre, sans celles d'un autre dossier", () => {
    expect(formations.rows.map((r) => r[3])).toEqual(["Master Data", "Master IA"]);
    expect(formations.rows[1][7]).toBe("Acceptée");
  });

  it("paiements par date, annulés signalés", () => {
    expect(paiements.rows.map((r) => [r[2], r[7], r[8]])).toEqual([
      ["2026-09-01", "Annulé", "Erreur"],
      ["2026-10-01", "Valide", null],
    ]);
    expect(paiements.rows[1][4]).toBe("Espèces");
  });
});

describe("exportFileName", () => {
  it("nom lisible et sans caractère interdit", () => {
    expect(exportFileName("Campus France 2026/27", "2026-10-15")).toBe("Campus France 2026 27 - 15-10-2026.xlsx");
    expect(exportFileName(" ", "2026-10-15")).toBe("Campagne - 15-10-2026.xlsx");
  });
});
