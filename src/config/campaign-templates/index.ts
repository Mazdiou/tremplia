import { campusFrance20262027 } from "./campus-france-2026-2027";
import type { CampaignTemplate } from "./schema";

export type { CampaignTemplate } from "./schema";

// Ajouter une année ou un pays : un nouveau fichier ici, puis un déploiement.
export const CAMPAIGN_TEMPLATES: readonly CampaignTemplate[] = [
  campusFrance20262027,
];

export function findCampaignTemplate(key: string): CampaignTemplate | null {
  return CAMPAIGN_TEMPLATES.find((t) => t.key === key) ?? null;
}
