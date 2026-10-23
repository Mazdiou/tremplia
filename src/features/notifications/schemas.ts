import { z } from "zod";

// Notifications sur le téléphone ou l'ordinateur (Web Push). Règles
// partagées entre le navigateur et le serveur ; la base impose les mêmes
// limites (migration push_notifications).

// Appareil abonné, tel que le donne le navigateur (PushSubscription.toJSON)
const key = (min: number, max: number) =>
  z.string().regex(new RegExp(`^[A-Za-z0-9_=-]{${min},${max}}$`), "Clé invalide");

export const pushEndpointSchema = z.object({
  endpoint: z
    .string()
    .max(1000, "Adresse invalide")
    .regex(/^https:\/\//, "Adresse invalide"),
});

export const pushSubscriptionSchema = pushEndpointSchema.extend({
  keys: z.object({ p256dh: key(20, 200), auth: key(8, 100) }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

// Essai vers cet appareil ; « delayed » : envoyé après TEST_DELAY_SECONDS,
// le temps de fermer complètement l'appli pour vérifier qu'il arrive quand
// même
export const TEST_DELAY_SECONDS = 15;
export const pushTestSchema = pushEndpointSchema.extend({ delayed: z.boolean().optional() });

// Choix de chaque membre, pour lui-même
export const notificationPreferencesSchema = z.object({
  studentMessages: z.boolean(),
  studentReviews: z.boolean(),
  assignedTasks: z.boolean(),
  dailyTasks: z.boolean(),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

// Sans choix enregistré
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  studentMessages: true,
  studentReviews: true,
  assignedTasks: true,
  dailyTasks: false,
};

export const PREFERENCE_KEYS = [
  "studentMessages",
  "studentReviews",
  "assignedTasks",
  "dailyTasks",
] as const satisfies readonly (keyof NotificationPreferences)[];

// Libellés de Réglages › Notifications. Les dossiers concernés dépendent du
// rôle : un patron reçoit aussi ceux qui n'ont pas de responsable actif.
export function preferenceInfo(isOwner: boolean) {
  const cases = isOwner
    ? "Dossiers dont vous êtes responsable, et ceux sans responsable."
    : "Dossiers dont vous êtes responsable.";
  return {
    studentMessages: { label: "Messages des candidats", description: cases },
    studentReviews: {
      label: "Réponses des candidats",
      description: `Lettre ou formations validées, demande de modification. ${cases}`,
    },
    assignedTasks: {
      label: "Tâches confiées",
      description: "Quand un collègue vous confie une tâche.",
    },
    dailyTasks: {
      label: "Tâches du jour",
      description: "Chaque matin vers 8 h, s'il y a des tâches pour aujourd'hui ou en retard.",
    },
  } satisfies Record<keyof NotificationPreferences, { label: string; description: string }>;
}
