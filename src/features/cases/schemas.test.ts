import { describe, expect, it } from "vitest";
import {
  BULK_MAX_CASES,
  bulkCasesSchema,
  caseSearchSchema,
  createCaseSchema,
  externalAccountUpdateSchema,
  newExternalAccountSchema,
} from "./schemas";
import { toCaseRecord } from "./case-record";

const CAMPAIGN = "6f1c2a0e-8b1d-4c6e-9f3a-2d4b5c6d7e8f";

const valid = {
  campaignId: CAMPAIGN,
  groupIds: [],
  firstName: " Sara ",
  lastName: "Benali",
  birthDate: "2004-05-01",
  phone: "0555 11 11 11",
  email: "",
  educationLevel: "l3",
  diplomas: [{ type: "baccalaureate", title: "", year: 2022 }],
  languageTests: [{ test: "tcf", otherName: "", result: "B2", date: "" }],
  externalAccounts: [],
};

function issues(input: unknown) {
  const r = createCaseSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
}

describe("createCaseSchema", () => {
  it("accepte un dossier minimal et nettoie les valeurs", () => {
    const d = createCaseSchema.parse(valid);
    expect(d.firstName).toBe("Sara");
    expect(d.email).toBeUndefined();
    expect(d.diplomas[0]).toEqual({ type: "baccalaureate", title: undefined, year: 2022 });
  });

  it("exige le contact secondaire complet ou absent", () => {
    expect(issues({ ...valid, secondaryContactName: "Mère" })).toEqual([
      "secondaryContactPhone",
    ]);
    expect(issues({ ...valid, secondaryContactPhone: "0555999999" })).toEqual([
      "secondaryContactName",
    ]);
  });

  it("refuse une date de naissance future ou impossible", () => {
    expect(issues({ ...valid, birthDate: "2999-01-01" })).toEqual(["birthDate"]);
    expect(issues({ ...valid, birthDate: "2004-02-30" })).toEqual(["birthDate"]);
  });

  it("exige le nom d'un test de langue « autre »", () => {
    expect(
      issues({ ...valid, languageTests: [{ test: "other", otherName: "", result: "", date: "" }] }),
    ).toEqual(["languageTests.0.otherName"]);
  });

  it("refuse plus de 10 diplômes et un niveau inconnu", () => {
    const many = Array.from({ length: 11 }, () => ({ type: "other" }));
    expect(issues({ ...valid, diplomas: many })).toEqual(["diplomas"]);
    expect(issues({ ...valid, educationLevel: "bac" })).toEqual(["educationLevel"]);
  });

  it("refuse deux comptes pour la même plateforme", () => {
    const account = { platform: "Pastel", status: "to_create" };
    expect(
      issues({ ...valid, externalAccounts: [account, { ...account, platform: "PASTEL" }] }),
    ).toEqual(["externalAccounts"]);
  });

  it("produit les colonnes de la base, sans valeur vide", () => {
    const record = toCaseRecord(createCaseSchema.parse(valid));
    expect(record.email).toBeNull();
    expect(record.language_tests).toEqual([
      { test: "tcf", other_name: null, result: "B2", date: null },
    ]);
  });
});

describe("comptes externes", () => {
  it("exige identifiant et mot de passe pour un compte existant", () => {
    const r = newExternalAccountSchema.safeParse({ platform: "Pastel", status: "existing" });
    expect(r.success ? [] : r.error.issues.map((i) => i.path.join("."))).toEqual([
      "login",
      "password",
    ]);
  });

  it("refuse un mot de passe pour un compte à créer", () => {
    expect(
      newExternalAccountSchema.safeParse({
        platform: "Pastel",
        status: "to_create",
        password: "x",
      }).success,
    ).toBe(false);
  });

  it("en modification, un mot de passe absent garde l'ancien", () => {
    expect(
      externalAccountUpdateSchema.safeParse({
        platform: "Pastel",
        status: "existing",
        login: "sara@example.com",
      }).success,
    ).toBe(true);
  });

  it("ne garde pas les espaces autour… sauf dans le mot de passe", () => {
    const a = newExternalAccountSchema.parse({
      platform: " Pastel ",
      status: "existing",
      login: "sara",
      password: " secret ",
    });
    expect(a.platform).toBe("Pastel");
    expect(a.password).toBe(" secret ");
  });

  it("refuse une adresse qui n'est pas http(s)", () => {
    expect(
      newExternalAccountSchema.safeParse({
        platform: "Pastel",
        status: "to_create",
        url: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });
});

describe("caseSearchSchema", () => {
  it("demande au moins 2 caractères", () => {
    expect(caseSearchSchema.safeParse({ query: " a " }).success).toBe(false);
    expect(caseSearchSchema.safeParse({ query: "be" }).success).toBe(true);
  });
});

describe("bulkCasesSchema", () => {
  const stage = { type: "stage", stageId: CAMPAIGN };

  it("accepte une étape ou un responsable pour des dossiers", () => {
    expect(bulkCasesSchema.safeParse({ caseIds: [CAMPAIGN], action: stage }).success).toBe(true);
    expect(
      bulkCasesSchema.safeParse({
        caseIds: [CAMPAIGN],
        action: { type: "assignee", assignedTo: CAMPAIGN },
      }).success,
    ).toBe(true);
  });

  it("accepte une même tâche pour des dossiers, intitulé obligatoire", () => {
    const task = { title: "Relancer pour le visa", dueDate: "", assignedTo: CAMPAIGN };
    expect(
      bulkCasesSchema.safeParse({ caseIds: [CAMPAIGN], action: { type: "task", task } }).success,
    ).toBe(true);
    expect(
      bulkCasesSchema.safeParse({
        caseIds: [CAMPAIGN],
        action: { type: "task", task: { ...task, title: " " } },
      }).success,
    ).toBe(false);
  });

  it("refuse une sélection vide ou trop grande", () => {
    expect(bulkCasesSchema.safeParse({ caseIds: [], action: stage }).success).toBe(false);
    const many = Array.from({ length: BULK_MAX_CASES + 1 }, () => CAMPAIGN);
    expect(bulkCasesSchema.safeParse({ caseIds: many, action: stage }).success).toBe(false);
  });

  it("refuse une action inconnue ou un identifiant invalide", () => {
    expect(
      bulkCasesSchema.safeParse({ caseIds: [CAMPAIGN], action: { type: "status", status: "closed" } })
        .success,
    ).toBe(false);
    expect(bulkCasesSchema.safeParse({ caseIds: ["x"], action: stage }).success).toBe(false);
  });
});
