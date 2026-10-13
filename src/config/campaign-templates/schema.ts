import { z } from "zod";
import {
  campaignDateSchema,
  campaignInfoSchema,
  campaignNameSchema,
  groupNamesSchema,
  MAX_CAMPAIGN_DATES,
  MAX_CAMPAIGN_INFOS,
  suggestedPlatformsSchema,
} from "@/features/campaigns/schemas";

// Modèle de campagne préconfiguré. L'import en fait une COPIE dans l'agence,
// entièrement modifiable ensuite ; le modèle n'y reste pas relié.
export const campaignTemplateSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Clé en minuscules et tirets"),
  name: campaignNameSchema,
  description: z.string().trim().min(1).max(300).optional(),
  suggestedPlatforms: suggestedPlatformsSchema,
  groups: groupNamesSchema,
  dates: z.array(campaignDateSchema).max(MAX_CAMPAIGN_DATES),
  infos: z.array(campaignInfoSchema).max(MAX_CAMPAIGN_INFOS),
});

export type CampaignTemplate = z.infer<typeof campaignTemplateSchema>;
