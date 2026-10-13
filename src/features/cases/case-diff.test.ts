import { describe, expect, it } from "vitest";
import { diffCase } from "./case-diff";
import type { CaseFieldsRecord } from "./case-record";

const base: CaseFieldsRecord = {
  first_name: "Sara",
  last_name: "Benali",
  birth_date: "2002-04-01",
  phone: "0555000000",
  email: "sara@example.com",
  city: "Alger",
  nationality: null,
  secondary_contact_name: null,
  secondary_contact_phone: null,
  education_level: "l2",
  current_field: "Informatique",
  current_institution: null,
  diplomas: [{ type: "baccalaureate", title: null, year: 2020 }],
  language_tests: [],
};

describe("diffCase", () => {
  it("ne signale rien quand rien ne change", () => {
    expect(diffCase(base, structuredClone(base)).fields).toEqual([]);
  });

  // Non-régression : la base rend les clés JSON dans un autre ordre, ce qui
  // faisait croire à une modification des diplômes à chaque enregistrement.
  it("ignore l'ordre des clés des objets JSON", () => {
    const fromDb = {
      ...base,
      diplomas: [{ year: 2020, type: "baccalaureate", title: null }],
    };
    expect(diffCase(fromDb, base).fields).toEqual([]);
  });

  it("traite une valeur absente comme vide", () => {
    expect(diffCase({ ...base, email: null }, { ...base, email: null }).fields).toEqual([]);
  });

  it("détecte un changement à l'intérieur d'une liste", () => {
    const next = {
      ...base,
      diplomas: [{ type: "baccalaureate", title: null, year: 2021 }],
    };
    const { fields, patch } = diffCase(base, next);
    expect(fields).toEqual(["diplomas"]);
    expect(patch).toEqual({ diplomas: next.diplomas });
  });

  it("garde le nom du champ mais jamais une valeur personnelle", () => {
    const next = {
      ...base,
      phone: "0666111111",
      email: "autre@example.com",
      birth_date: "2001-01-01",
      current_institution: "Université d'Alger",
      education_level: "l3",
    };
    const { fields, changes } = diffCase(base, next);
    expect(fields).toEqual([
      "birth_date",
      "phone",
      "email",
      "education_level",
      "current_institution",
    ]);
    expect(changes).toEqual({ education_level_from: "l2", education_level_to: "l3" });
    for (const secret of ["0666111111", "autre@example.com", "2001-01-01", "Université d'Alger"]) {
      expect(JSON.stringify(changes)).not.toContain(secret);
    }
  });
});
