export const CAMPAIGN_STATUSES = ["active", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  active: "Active",
  archived: "Archivée",
};

// Pseudo-groupe de l'arbre : dossiers rangés dans aucun groupe
export const UNCLASSIFIED_LABEL = "Non classés";
