import { describe, expect, it } from "vitest";
import {
  CASE_STATUSES,
  DIPLOMAS,
  DIPLOMA_LABELS,
  LANGUAGE_TESTS,
  LANGUAGE_TEST_LABELS,
  LEVEL_LABELS,
  LEVEL_ORDER,
  SCOPES,
  SCOPE_LABELS,
  STATUS_LABELS,
  TRACKS,
  TRACK_LABELS,
} from "./labels";

const lists: [readonly string[], Record<string, string>][] = [
  [LEVEL_ORDER, LEVEL_LABELS],
  [CASE_STATUSES, STATUS_LABELS],
  [SCOPES, SCOPE_LABELS],
  [TRACKS, TRACK_LABELS],
  [LANGUAGE_TESTS, LANGUAGE_TEST_LABELS],
  [DIPLOMAS, DIPLOMA_LABELS],
];

describe("listes du dossier", () => {
  it("donne un libellé non vide à chaque valeur, et rien de plus", () => {
    for (const [values, labels] of lists) {
      expect(Object.keys(labels).sort()).toEqual([...values].sort());
      for (const v of values) expect(labels[v].trim()).not.toBe("");
    }
  });
});
