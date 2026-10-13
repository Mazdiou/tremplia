import { describe, expect, it } from "vitest";
import type { TreeCase } from "./fetch-campaign-cases";
import { buildCampaignBranches, type TreeGroup } from "./tree";

const person = (id: string, campaign = "fr"): TreeCase => ({
  id,
  campaign_id: campaign,
  first_name: id,
  last_name: id,
  education_level: "l3",
  status: "active",
  assigned_to: null,
});

const groups: TreeGroup[] = [
  { id: "ecole", campaign_id: "fr", name: "École", position: 2 },
  { id: "dap", campaign_id: "fr", name: "DAP", position: 0 },
  { id: "it", campaign_id: "it", name: "Licence", position: 0 },
];

const shape = (branches: ReturnType<typeof buildCampaignBranches>) =>
  branches.map((b) => [b.label, b.cases.map((c) => c.id)]);

describe("buildCampaignBranches", () => {
  it("range les dossiers dans les groupes de leur campagne, dans l'ordre", () => {
    const cases = [person("a"), person("b"), person("z", "it")];
    const caseGroups = [
      { case_id: "a", group_id: "dap" },
      { case_id: "b", group_id: "ecole" },
    ];
    expect(shape(buildCampaignBranches("fr", groups, cases, caseGroups))).toEqual([
      ["DAP", ["a"]],
      ["École", ["b"]],
    ]);
  });

  it("montre un dossier dans chacun de ses groupes", () => {
    const branches = buildCampaignBranches("fr", groups, [person("a")], [
      { case_id: "a", group_id: "dap" },
      { case_id: "a", group_id: "ecole" },
    ]);
    expect(shape(branches)).toEqual([
      ["DAP", ["a"]],
      ["École", ["a"]],
    ]);
  });

  it("ajoute « Non classés » seulement s'il contient des dossiers", () => {
    expect(buildCampaignBranches("fr", groups, [], []).map((b) => b.label)).toEqual([
      "DAP",
      "École",
    ]);
    const branches = buildCampaignBranches("fr", groups, [person("c")], []);
    expect(branches.at(-1)).toMatchObject({ label: "Non classés", groupId: null });
    expect(branches.at(-1)?.cases.map((c) => c.id)).toEqual(["c"]);
  });

  it("garde visible un dossier classé dans un groupe disparu", () => {
    const branches = buildCampaignBranches("fr", groups, [person("d")], [
      { case_id: "d", group_id: "supprime" },
    ]);
    expect(branches.at(-1)?.cases.map((c) => c.id)).toEqual(["d"]);
  });

  it("une campagne sans groupe n'a que « Non classés »", () => {
    expect(shape(buildCampaignBranches("nl", groups, [person("e", "nl")], []))).toEqual([
      ["Non classés", ["e"]],
    ]);
  });
});
