// Étapes des dossiers : chaque campagne a sa liste ordonnée, chaque dossier
// en occupe une (aucune si sa campagne n'en a pas).

export type CampaignStage = {
  id: string;
  campaign_id: string;
  name: string;
  position: number;
};

// Proposées à la création d'une campagne, modifiables ensuite. Le modèle
// Campus France a les siennes (src/config/campaign-templates). La migration
// case_stages en a donné une copie aux campagnes déjà créées.
export const DEFAULT_STAGES = [
  "Constitution du dossier",
  "Candidatures envoyées",
  "Réponses des établissements",
  "Demande de visa",
] as const;

// Étapes d'une campagne, dans l'ordre
export function stagesOf<T extends Pick<CampaignStage, "campaign_id" | "position">>(
  stages: T[],
  campaignId: string,
): T[] {
  return stages
    .filter((s) => s.campaign_id === campaignId)
    .sort((a, b) => a.position - b.position);
}

// Place d'un dossier dans les étapes de sa campagne : « 2 / 5 ». null si le
// dossier n'a pas d'étape (ou une étape inconnue, lue entre deux écritures).
export function stageProgress<T extends { id: string }>(
  ordered: T[],
  stageId: string | null,
): { stage: T; index: number; total: number; next: T | null } | null {
  const index = ordered.findIndex((s) => s.id === stageId);
  if (index < 0) return null;
  return {
    stage: ordered[index],
    index,
    total: ordered.length,
    next: ordered[index + 1] ?? null,
  };
}

// Filtre de l'arbre : les étapes sont propres à chaque campagne, on filtre
// donc sur le NOM (« Entretien » dans toutes les campagnes qui en ont une).
export function stageKey(name: string) {
  return name.trim().toLocaleLowerCase("fr");
}

// Noms d'étapes proposés par le filtre : une fois chacun, dans l'ordre des
// campagnes puis des positions
export function stageFilterOptions(stages: CampaignStage[], campaignIds: string[]) {
  const seen = new Map<string, string>();
  for (const id of campaignIds) {
    for (const s of stagesOf(stages, id)) {
      if (!seen.has(stageKey(s.name))) seen.set(stageKey(s.name), s.name);
    }
  }
  return [...seen].map(([key, name]) => ({ key, name }));
}

// Où vont les dossiers d'une étape retirée (même règle que la fonction SQL
// replace_campaign_stages) : à l'étape gardée qui la précédait, sinon à la
// première de la nouvelle liste. `before` : identifiants dans l'ordre actuel ;
// `after` : nouvelle liste, null pour une étape nouvelle.
export function removalTargets(
  before: string[],
  after: (string | null)[],
): Map<string, number> {
  const kept = new Set(after.filter((id): id is string => id !== null));
  const targets = new Map<string, number>();
  before.forEach((id, i) => {
    if (kept.has(id)) return;
    const previous = before
      .slice(0, i)
      .reverse()
      .find((p) => kept.has(p));
    targets.set(id, previous ? after.indexOf(previous) : 0);
  });
  return targets;
}
