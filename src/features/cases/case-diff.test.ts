import { describe, expect, it } from "vitest";
import { diffCase, type CaseEditable } from "./case-diff";

const base: CaseEditable = {
  first_name: "Sara",
  last_name: "Benali",
  birth_date: "2002-04-01",
  phone: "0555000000",
  email: "sara@example.com",
  education_level: "l2",
  main_track: "dap",
  schools: false,
  scope: "both",
  language_tests: ["fr", "en"],
  diplomas: ["bac"],
  assigned_to: null,
};

describe("diffCase", () => {
  it("ne signale rien quand rien ne change", () => {
    expect(diffCase(base, { ...base }).fields).toEqual([]);
  });

  it("ignore l'ordre et les doublons des listes", () => {
    const next = { ...base, language_tests: ["en", "fr", "fr"] };
    expect(diffCase(base, next).fields).toEqual([]);
  });

  it("garde le nom du champ mais jamais la valeur du téléphone, de l'e-mail ni de la date de naissance", () => {
    const next = {
      ...base,
      phone: "0666111111",
      email: "autre@example.com",
      birth_date: "2001-01-01",
      education_level: "l3",
    };
    const { fields, changes } = diffCase(base, next);
    expect(fields).toEqual(["birth_date", "phone", "email", "education_level"]);
    expect(Object.keys(changes)).toEqual(["education_level"]);
    expect(JSON.stringify(changes)).not.toContain("0666111111");
    expect(JSON.stringify(changes)).not.toContain("autre@example.com");
  });
});
