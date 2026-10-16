import { z } from "zod";
import { emailSchema } from "@/features/auth/schemas";
import { requiredText } from "@/lib/validation";

export const newEmployeeSchema = z.object({
  firstName: requiredText(100, "Saisissez le prénom"),
  lastName: requiredText(100, "Saisissez le nom"),
  email: emailSchema,
});
export type NewEmployeeInput = z.infer<typeof newEmployeeSchema>;

export const employeeStatusSchema = z.object({ isActive: z.boolean() });
