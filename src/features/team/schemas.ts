import { z } from "zod";
import { emailSchema } from "@/features/auth/schemas";
import { requiredText } from "@/lib/validation";
import { PERMISSIONS } from "@/lib/permissions";

export const newEmployeeSchema = z.object({
  firstName: requiredText(100, "Saisissez le prénom"),
  lastName: requiredText(100, "Saisissez le nom"),
  email: emailSchema,
});
export type NewEmployeeInput = z.infer<typeof newEmployeeSchema>;

export const employeeStatusSchema = z.object({ isActive: z.boolean() });

// Liste complète des permissions de l'employé (vide : aucune)
export const employeePermissionsSchema = z.object({
  permissions: z.array(z.enum(PERMISSIONS, "Permission inconnue")).max(PERMISSIONS.length),
});
