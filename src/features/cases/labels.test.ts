import { describe, expect, it } from "vitest";
import {
  CASE_STATUSES,
  DIPLOMA_TYPES,
  DIPLOMA_TYPE_LABELS,
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  EXTERNAL_ACCOUNT_STATUSES,
  EXTERNAL_ACCOUNT_STATUS_LABELS,
  LANGUAGE_TESTS,
  LANGUAGE_TEST_LABELS,
  STATUS_LABELS,
  educationRank,
} from "./labels";

const lists: [readonly string[], Record<string, string>][] = [
  [EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS],
  [CASE_STATUSES, STATUS_LABELS],
  [DIPLOMA_TYPES, DIPLOMA_TYPE_LABELS],
  [LANGUAGE_TESTS, LANGUAGE_TEST_LABELS],
  [EXTERNAL_ACCOUNT_STATUSES, EXTERNAL_ACCOUNT_STATUS_LABELS],
];

describe("listes du dossier", () => {
  it("donne un libellé non vide à chaque valeur, et rien de plus", () => {
    for (const [values, labels] of lists) {
      expect(Object.keys(labels).sort()).toEqual([...values].sort());
      for (const v of values) expect(labels[v].trim()).not.toBe("");
    }
  });

  it("classe les niveaux dans l'ordre du parcours, l'inconnu à la fin", () => {
    expect(educationRank("terminale")).toBeLessThan(educationRank("l1"));
    expect(educationRank("bac_plus_2")).toBeLessThan(educationRank("l3"));
    expect(educationRank("m2")).toBeLessThan(educationRank("doctorate"));
    expect(educationRank("inconnu")).toBe(EDUCATION_LEVELS.length);
  });
});
