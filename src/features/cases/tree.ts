import { UNCLASSIFIED_LABEL } from "@/features/campaigns/labels";
import type { PaymentFilter, UiPrefs } from "@/lib/ui-prefs";
import type { TreeCase, TreeCaseGroup } from "./fetch-campaign-cases";
import { educationRank } from "./labels";

export type TreeGroup = {
  id: string;
  campaign_id: string;
  name: string;
  position: number;
};

type TreeBranch<C> = {
  key: string;
  // null : « Non classés », qui n'est pas un vrai groupe
  groupId: string | null;
  label: string;
  cases: C[];
};

// Branches d'une campagne : ses groupes dans l'ordre, puis « Non classés »
// s'il contient des dossiers. Un dossier rangé dans plusieurs groupes
// apparaît dans chacun. `cases` est déjà filtré et trié par l'appelant.
// Sert aussi à la copie des documents sur l'ordinateur (même arbre).
export function buildCampaignBranches<C extends Pick<TreeCase, "id" | "campaign_id">>(
  campaignId: string,
  groups: TreeGroup[],
  cases: C[],
  caseGroups: TreeCaseGroup[],
): TreeBranch<C>[] {
  const own = cases.filter((c) => c.campaign_id === campaignId);
  const groupsByCase = new Map<string, Set<string>>();
  for (const cg of caseGroups) {
    const set = groupsByCase.get(cg.case_id) ?? new Set<string>();
    set.add(cg.group_id);
    groupsByCase.set(cg.case_id, set);
  }

  const branches: TreeBranch<C>[] = groups
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

const collator = new Intl.Collator("fr", { sensitivity: "base" });

type Sortable = Pick<TreeCase, "first_name" | "last_name" | "education_level">;

function byName(a: Sortable, b: Sortable) {
  return (
    collator.compare(a.last_name, b.last_name) ||
    collator.compare(a.first_name, b.first_name)
  );
}

function byLevel(a: Sortable, b: Sortable) {
  return educationRank(a.education_level) - educationRank(b.education_level) || byName(a, b);
}

// Ordre des dossiers dans une branche : nom (accents et casse ignorés), ou
// niveau d'études puis nom
export function treeCaseOrder(sortBy: UiPrefs["sortBy"]) {
  return sortBy === "level" ? byLevel : byName;
}

// Filtre des paiements de l'arbre : reste à payer, soldés (gratuits compris),
// montant convenu pas encore fixé
export function matchesPayment(
  c: Pick<TreeCase, "agreed_amount" | "remaining_amount">,
  filter: PaymentFilter,
) {
  if (filter === "due") return (c.remaining_amount ?? 0) > 0;
  if (filter === "paid") return c.agreed_amount !== null && c.remaining_amount === 0;
  if (filter === "unset") return c.agreed_amount === null;
  return true;
}

// Filtres vides de l'arbre (bouton « Réinitialiser »)
export const NO_FILTERS = {
  level: "",
  responsible: "",
  mine: false,
  payment: "" as PaymentFilter,
  stage: "",
  overdue: false,
};

// Filtre de l'arbre demandé par un lien (cartes du tableau de bord, étapes
// d'une campagne) : /cases?filtre=mes-dossiers, reste-a-payer,
// montant-a-fixer ou taches-en-retard, ou /cases?etape=<clé d'étape>.
// Remplace les filtres en cours ; null pour une valeur inconnue.
export function linkFilter(
  value: string | null,
  stageKey: string | null = null,
): typeof NO_FILTERS | null {
  if (stageKey) return { ...NO_FILTERS, stage: stageKey };
  if (value === "mes-dossiers") return { ...NO_FILTERS, mine: true };
  if (value === "reste-a-payer") return { ...NO_FILTERS, payment: "due" };
  if (value === "montant-a-fixer") return { ...NO_FILTERS, payment: "unset" };
  if (value === "taches-en-retard") return { ...NO_FILTERS, overdue: true };
  return null;
}
