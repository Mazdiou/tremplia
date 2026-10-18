import { daysUntil } from "@/lib/dates";

// Échéances des tâches : dates seules (AAAA-MM-JJ), comparées au jour de
// l'application (todayInAppTimezone), jamais à l'heure du serveur.

export type DueState = "overdue" | "today" | "week" | "later" | "none";

export function dueState(due: string | null, today: string): DueState {
  if (!due) return "none";
  const days = daysUntil(due, today);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 7) return "week";
  return "later";
}

export function addDays(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const weekdayFormat = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
});
const fullFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" });

// « aujourd'hui », « demain », « hier », sinon « lun. 27/10 » (l'année
// seulement si elle diffère)
export function dueLabel(due: string, today: string) {
  const days = daysUntil(due, today);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  if (days === -1) return "hier";
  const date = new Date(`${due}T00:00:00Z`);
  return due.slice(0, 4) === today.slice(0, 4) ? weekdayFormat.format(date) : fullFormat.format(date);
}

// Raccourcis du formulaire et du report. « Lundi prochain » : le lundi d'au
// moins deux jours plus tard, pour ne pas doubler « Demain ».
export function quickDueDates(today: string) {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = dimanche
  let toMonday = (8 - weekday) % 7 || 7;
  if (toMonday < 2) toMonday += 7;
  return [
    { label: "Aujourd'hui", date: today },
    { label: "Demain", date: addDays(today, 1) },
    { label: "Dans 3 jours", date: addDays(today, 3) },
    { label: "Lundi prochain", date: addDays(today, toMonday) },
  ];
}

// Ordre des tâches à faire : par échéance (en retard d'abord), les tâches
// sans échéance à la fin, puis par date de création
export function compareOpenTasks(
  a: { dueDate: string | null; createdAt: string },
  b: { dueDate: string | null; createdAt: string },
) {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate < b.dueDate ? -1 : 1;
  }
  return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0;
}
