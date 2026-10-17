import { z } from "zod";
import { passwordSchema } from "@/features/auth/schemas";
import { suggestedPlatformsSchema } from "@/features/campaigns/schemas";
import { optionalAmountSchema } from "@/features/payments/schemas";
import { stageNamesSchema } from "@/features/stages/schemas";
import { phoneSchema, requiredText } from "@/lib/validation";

// Page Réglages. La base impose les mêmes limites (migration agency_settings).

export const agencyProfileSchema = z.object({
  name: requiredText(100, "Saisissez le nom de l'agence"),
  city: requiredText(100, "Saisissez la ville"),
  phone: phoneSchema,
});
export type AgencyProfileInput = z.infer<typeof agencyProfileSchema>;

// Proposées à chaque nouvelle campagne, modifiables ensuite sur la campagne
export const campaignDefaultsSchema = z.object({
  defaultFee: optionalAmountSchema,
  platforms: suggestedPlatformsSchema,
  stages: stageNamesSchema,
});
export type CampaignDefaultsInput = z.infer<typeof campaignDefaultsSchema>;

export const ownNameSchema = z.object({
  firstName: requiredText(100, "Saisissez votre prénom"),
  lastName: requiredText(100, "Saisissez votre nom"),
});
export type OwnNameInput = z.infer<typeof ownNameSchema>;

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Saisissez votre mot de passe actuel").max(72),
    password: passwordSchema,
  })
  .refine((v) => v.password !== v.currentPassword, {
    path: ["password"],
    message: "Choisissez un mot de passe différent de l'actuel",
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
