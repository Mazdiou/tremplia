import { describe, expect, it } from "vitest";
import type { TreeCase } from "./fetch-campaign-cases";
import {
  buildCampaignBranches,
  linkFilter,
  matchesPayment,
  treeCaseOrder,
  type TreeGroup,
} from "./tree";

const person = (id: string, campaign = "fr"): TreeCase => ({
  id,
  campaign_id: campaign,
  first_name: id,
  last_name: id,
  education_level: "l3",
  status: "active",
  assigned_to: null,
  agreed_amount: null,
  remaining_amount: null,
  stage_id: null,
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

describe("matchesPayment", () => {
  const due = { ...person("a"), agreed_amount: 150000, remaining_amount: 90000 };
  const paid = { ...person("b"), agreed_amount: 150000, remaining_amount: 0 };
  const free = { ...person("c"), agreed_amount: 0, remaining_amount: 0 };
  const unset = person("d");

  it("sans filtre, tout passe", () => {
    expect([due, paid, free, unset].every((c) => matchesPayment(c, ""))).toBe(true);
  });

  it("reste à payer, soldés, montant à fixer", () => {
    expect([due, paid, free, unset].filter((c) => matchesPayment(c, "due"))).toEqual([due]);
    expect([due, paid, free, unset].filter((c) => matchesPayment(c, "paid"))).toEqual([paid, free]);
    expect([due, paid, free, unset].filter((c) => matchesPayment(c, "unset"))).toEqual([unset]);
  });
});

describe("linkFilter", () => {
  it("traduit les liens du tableau de bord en filtres de l'arbre", () => {
    expect(linkFilter("mes-dossiers")).toEqual({
      level: "",
      responsible: "",
      mine: true,
      payment: "",
      stage: "",
      overdue: false,
    });
    expect(linkFilter("reste-a-payer")?.payment).toBe("due");
    expect(linkFilter("montant-a-fixer")?.payment).toBe("unset");
    expect(linkFilter("taches-en-retard")?.overdue).toBe(true);
  });
  it("traduit le lien d'une étape en filtre d'étape", () => {
    expect(linkFilter(null, "entretien")).toMatchObject({ stage: "entretien", payment: "" });
  });
  it("ignore une valeur inconnue", () => {
    expect(linkFilter("autre")).toBeNull();
    expect(linkFilter(null)).toBeNull();
  });
});

describe("treeCaseOrder", () => {
  const c = (last: string, first: string, level: string) => ({
    ...person(`${last}-${first}`),
    last_name: last,
    first_name: first,
    education_level: level,
  });
  const names = (list: TreeCase[]) => list.map((x) => `${x.last_name} ${x.first_name}`);

  it("trie par nom puis prénom, sans tenir compte des accents ni de la casse", () => {
    const list = [c("Zitouni", "Ali", "l1"), c("élias", "Yanis", "m1"), c("Elias", "Amel", "l3")];
    expect(names([...list].sort(treeCaseOrder("name")))).toEqual([
      "Elias Amel",
      "élias Yanis",
      "Zitouni Ali",
    ]);
  });

  it("trie par niveau d'études, puis par nom à niveau égal", () => {
    const list = [c("Brahimi", "Ines", "m1"), c("Amrani", "Sofia", "l3"), c("Aouadi", "Rayan", "m1")];
    expect(names([...list].sort(treeCaseOrder("level")))).toEqual([
      "Amrani Sofia",
      "Aouadi Rayan",
      "Brahimi Ines",
    ]);
  });
});
