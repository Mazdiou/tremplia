import { z } from "zod";
import { emptyToUndefined, isoDateSchema, optionalText, requiredText, uuidSchema } from "@/lib/validation";

// Règles partagées entre le navigateur et le serveur. La base impose les
// mêmes : intitulé de 1 à 200 caractères, précision de 500 au plus, échéance
// entre 2020 et 2100, 100 tâches à faire au plus par dossier.
export const MAX_TASK_TITLE = 200;
export const MAX_TASK_DETAILS = 500;
export const MAX_OPEN_TASKS = 100;

const dueDateSchema = z.preprocess(
  emptyToUndefined,
  isoDateSchema
    .refine((d) => d >= "2020-01-01" && d <= "2100-12-31", "Date invalide")
    .optional(),
);

export const taskSchema = z.object({
  title: requiredText(MAX_TASK_TITLE, "Écrivez la tâche"),
  details: optionalText(MAX_TASK_DETAILS),
  dueDate: dueDateSchema,
  assignedTo: uuidSchema,
});

export type TaskInput = z.infer<typeof taskSchema>;

export const taskDoneSchema = z.object({ done: z.boolean() });
