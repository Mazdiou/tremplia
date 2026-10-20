import { describe, expect, it } from "vitest";
import { buildCopyPlan, type PlanData } from "./plan";

const T = (n: number) => `2026-10-0${n}T10:00:00Z`;

function data(over: Partial<PlanData> = {}): PlanData {
  return {
    campaigns: [{ id: "cf", name: "Campus France 2026/2027" }],
    groups: [
      { id: "dap", campaign_id: "cf", name: "DAP", position: 1 },
      { id: "hors", campaign_id: "cf", name: "HORS DAP", position: 2 },
    ],
    cases: [
      { id: "sara", campaign_id: "cf", first_name: "Sara", last_name: "Benali", created_at: T(1) },
      { id: "amine", campaign_id: "cf", first_name: "Amine", last_name: "Kaci", created_at: T(2) },
      { id: "yanis", campaign_id: "cf", first_name: "Yanis", last_name: "Hadj", created_at: T(3) },
    ],
    caseGroups: [
      { case_id: "sara", group_id: "dap" },
      { case_id: "sara", group_id: "hors" },
      { case_id: "amine", group_id: "hors" },
    ],
    folders: [{ id: "perso", case_id: "sara", name: "Informations personnelles" }],
    documents: [
      { id: "pass", case_id: "sara", folder_id: "perso", name: "Passeport", created_at: T(1), updated_at: T(4), size_bytes: 10 },
      { id: "bac", case_id: "sara", folder_id: null, name: "Bac", created_at: T(2), updated_at: T(2), size_bytes: 20 },
      { id: "cv", case_id: "yanis", folder_id: null, name: "CV", created_at: T(1), updated_at: T(1), size_bytes: 30 },
    ],
    ...over,
  };
}

const paths = (d: PlanData) => buildCopyPlan(d).map((e) => e.path).sort();

describe("buildCopyPlan", () => {
  it("reprend l'arbre : campagne, groupes, Non classés, candidat, dossiers de documents", () => {
    expect(paths(data())).toEqual([
      "Campus France 2026-2027/DAP/BENALI Sara/Bac.pdf",
      "Campus France 2026-2027/DAP/BENALI Sara/Informations personnelles/Passeport.pdf",
      "Campus France 2026-2027/HORS DAP/BENALI Sara/Bac.pdf",
      "Campus France 2026-2027/HORS DAP/BENALI Sara/Informations personnelles/Passeport.pdf",
      "Campus France 2026-2027/Non classés/HADJ Yanis/CV.pdf",
    ]);
  });

  it("donne pour chaque fichier le document, le dossier, la version et la taille", () => {
    const pass = buildCopyPlan(data()).find((e) => e.path.startsWith("Campus France 2026-2027/DAP/") && e.docId === "pass");
    expect(pass).toEqual({
      path: "Campus France 2026-2027/DAP/BENALI Sara/Informations personnelles/Passeport.pdf",
      docId: "pass",
      caseId: "sara",
      version: T(4),
      size: 10,
    });
  });

  it("numérote les homonymes d'un groupe : le plus ancien garde le nom", () => {
    const d = data({
      cases: [
        { id: "z-new", campaign_id: "cf", first_name: "Sara", last_name: "BENALI", created_at: T(5) },
        { id: "a-old", campaign_id: "cf", first_name: "sara", last_name: "Benali", created_at: T(1) },
      ],
      caseGroups: [],
      folders: [],
      documents: [
        { id: "d1", case_id: "z-new", folder_id: null, name: "CV", created_at: T(5), updated_at: T(5), size_bytes: 1 },
        { id: "d2", case_id: "a-old", folder_id: null, name: "CV", created_at: T(1), updated_at: T(1), size_bytes: 1 },
      ],
    });
    const byDoc = new Map(buildCopyPlan(d).map((e) => [e.docId, e.path]));
    expect(byDoc.get("d2")).toBe("Campus France 2026-2027/Non classés/BENALI sara/CV.pdf");
    expect(byDoc.get("d1")).toBe("Campus France 2026-2027/Non classés/BENALI Sara (2)/CV.pdf");
  });

  it("distingue deux campagnes ou deux groupes au même nom une fois nettoyé", () => {
    const d = data({
      campaigns: [
        { id: "a", name: "Canada: 2027" },
        { id: "b", name: "Canada- 2027" },
      ],
      groups: [
        { id: "g1", campaign_id: "a", name: "Non classés", position: 1 },
      ],
      cases: [
        { id: "c1", campaign_id: "a", first_name: "A", last_name: "B", created_at: T(1) },
        { id: "c2", campaign_id: "a", first_name: "C", last_name: "D", created_at: T(1) },
        { id: "c3", campaign_id: "b", first_name: "E", last_name: "F", created_at: T(1) },
      ],
      caseGroups: [{ case_id: "c1", group_id: "g1" }],
      folders: [],
      documents: ["c1", "c2", "c3"].map((c) => ({
        id: `d-${c}`, case_id: c, folder_id: null, name: "Doc", created_at: T(1), updated_at: T(1), size_bytes: 1,
      })),
    });
    const byDoc = new Map(buildCopyPlan(d).map((e) => [e.docId, e.path.split("/")]));
    // Deux campagnes, deux dossiers distincts
    expect(new Set([byDoc.get("d-c1")?.[0], byDoc.get("d-c3")?.[0]])).toEqual(
      new Set(["Canada- 2027", "Canada- 2027 (2)"]),
    );
    // Un vrai groupe « Non classés » et la branche des non classés
    expect(byDoc.get("d-c1")?.slice(1)).toEqual(["Non classés", "B A", "Doc.pdf"]);
    expect(byDoc.get("d-c2")?.slice(1)).toEqual(["Non classés (2)", "D C", "Doc.pdf"]);
  });

  it("ignore les documents d'un dossier absent du plan (clos, campagne archivée)", () => {
    const d = data({
      documents: [
        { id: "x", case_id: "inconnu", folder_id: null, name: "X", created_at: T(1), updated_at: T(1), size_bytes: 1 },
      ],
    });
    expect(paths(d)).toEqual([]);
  });
});
