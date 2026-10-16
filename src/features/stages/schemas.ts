import { z } from "zod";
import { isUniqueIgnoringCase, requiredText, uuidSchema } from "@/lib/validation";

// Limites partagées avec la base (migration case_stages)
export const MAX_STAGES = 15;

export const stageNameSchema = requiredText(60, "Saisissez un nom d'étape");

// Étapes de départ d'une nouvelle campagne (ou d'un modèle), dans l'ordre
export const stageNamesSchema = z
  .array(stageNameSchema)
  .max(MAX_STAGES, `${MAX_STAGES} étapes au maximum`)
  .refine(isUniqueIgnoringCase, "Deux étapes portent le même nom");

// Liste complète des étapes d'une campagne : une étape gardée garde son
// identifiant, une nouvelle n'en a pas
export const replaceStagesSchema = z.object({
  stages: z
    .array(z.object({ id: uuidSchema.nullable(), name: stageNameSchema }))
    .max(MAX_STAGES, `${MAX_STAGES} étapes au maximum`)
    .refine(
      (stages) => isUniqueIgnoringCase(stages.map((s) => s.name)),
      "Deux étapes portent le même nom",
    ),
});

export const caseStageSchema = z.object({ stageId: uuidSchema });
