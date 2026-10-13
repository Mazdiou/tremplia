import { UNCLASSIFIED_LABEL } from "@/features/campaigns/labels";
import type { TreeCase, TreeCaseGroup } from "./fetch-campaign-cases";

export type TreeGroup = {
  id: string;
  campaign_id: string;
  name: string;
  position: number;
};

export type TreeBranch = {
  key: string;
  // null : « Non classés », qui n'est pas un vrai groupe
  groupId: string | null;
  label: string;
  cases: TreeCase[];
};

// Branches d'une campagne : ses groupes dans l'ordre, puis « Non classés »
// s'il contient des dossiers. Un dossier rangé dans plusieurs groupes
// apparaît dans chacun. `cases` est déjà filtré et trié par l'appelant.
export function buildCampaignBranches(
  campaignId: string,
  groups: TreeGroup[],
  cases: TreeCase[],
  caseGroups: TreeCaseGroup[],
): TreeBranch[] {
  const own = cases.filter((c) => c.campaign_id === campaignId);
  const groupsByCase = new Map<string, Set<string>>();
  for (const cg of caseGroups) {
    const set = groupsByCase.get(cg.case_id) ?? new Set<string>();
    set.add(cg.group_id);
    groupsByCase.set(cg.case_id, set);
  }

  const branches: TreeBranch[] = groups
    .filter((g) => g.campaign_id === campaignId)
    .sort((a, b) => a.position - b.position)
    .map((g) => ({
      key: `${campaignId}:${g.id}`,
      groupId: g.id,
      label: g.name,
      cases: own.filter((c) => groupsByCase.get(c.id)?.has(g.id)),
    }));

  // Un classement vers un groupe inconnu (supprimé entre deux lectures)
  // ne doit pas faire disparaître le dossier
  const known = new Set(branches.map((b) => b.groupId));
  const unclassified = own.filter(
    (c) => ![...(groupsByCase.get(c.id) ?? [])].some((g) => known.has(g)),
  );
  if (unclassified.length > 0) {
    branches.push({
      key: `${campaignId}:unclassified`,
      groupId: null,
      label: UNCLASSIFIED_LABEL,
      cases: unclassified,
    });
  }
  return branches;
}
