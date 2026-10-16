import { z } from "zod";
import { optionalAmountSchema } from "@/features/payments/schemas";
import { stageNamesSchema } from "@/features/stages/schemas";
import {
  isoDateSchema,
  isUniqueIgnoringCase,
  requiredText,
} from "@/lib/validation";

// Limites partagées avec la base (migration campaigns)
export const MAX_CAMPAIGN_DATES = 30;
export const MAX_CAMPAIGN_INFOS = 30;
export const MAX_CAMPAIGN_GROUPS = 30;
export const MAX_SUGGESTED_PLATFORMS = 10;

export const campaignNameSchema = requiredText(100, "Saisissez un nom de campagne");

export const campaignDateSchema = z.object({
  label: requiredText(100, "Saisissez un libellé"),
  date: isoDateSchema.refine(
    (d) => d >= "2000-01-01" && d <= "2100-12-31",
    "Date hors limites",
  ),
});

export const campaignInfoSchema = z.object({
  label: requiredText(100, "Saisissez un libellé"),
  value: requiredText(500, "Saisissez une valeur"),
});

const platformNameSchema = requiredText(80, "Saisissez une plateforme");

export const suggestedPlatformsSchema = z
  .array(platformNameSchema)
  .max(MAX_SUGGESTED_PLATFORMS, `${MAX_SUGGESTED_PLATFORMS} plateformes au maximum`)
  .refine(isUniqueIgnoringCase, "Cette plateforme est déjà dans la liste");

const groupNameSchema = requiredText(80, "Saisissez un nom de groupe");

export const groupNamesSchema = z
  .array(groupNameSchema)
  .max(MAX_CAMPAIGN_GROUPS, `${MAX_CAMPAIGN_GROUPS} groupes au maximum`)
  .refine(isUniqueIgnoringCase, "Deux groupes portent le même nom");

// Réglages modifiables d'une campagne
export const campaignSettingsSchema = z.object({
  name: campaignNameSchema,
  dates: z
    .array(campaignDateSchema)
    .max(MAX_CAMPAIGN_DATES, `${MAX_CAMPAIGN_DATES} dates au maximum`),
  infos: z
    .array(campaignInfoSchema)
    .max(MAX_CAMPAIGN_INFOS, `${MAX_CAMPAIGN_INFOS} informations au maximum`),
  suggestedPlatforms: suggestedPlatformsSchema,
  // Tarif proposé comme montant convenu des nouveaux dossiers (facultatif)
  defaultFee: optionalAmountSchema,
});

export const createCampaignSchema = campaignSettingsSchema.extend({
  groups: groupNamesSchema,
  // Étapes de départ des dossiers (modifiables ensuite sur la campagne)
  stages: stageNamesSchema,
});

export const importCampaignSchema = z.object({
  templateKey: z.string().min(1).max(100),
});

export const groupSchema = z.object({ name: groupNameSchema });

export type CampaignSettings = z.infer<typeof campaignSettingsSchema>;
