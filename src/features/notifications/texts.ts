import { plural } from "@/lib/plural";

// Contenu des notifications. Court : l'écran de verrouillage n'en montre
// que deux lignes. Le service de notification du navigateur (Google,
// Apple, Mozilla) ne le lit pas : il est chiffré pour l'appareil.

export type PushPayload = {
  title: string;
  body: string;
  // Page ouverte au toucher (toujours une adresse du site)
  url: string;
  // Une notification du même tag remplace la précédente (plusieurs
  // messages d'un même dossier = une seule notification)
  tag: string;
};

const PREVIEW_LENGTH = 140;

// « de Karim », « d'Atlas Études »
export function ofName(name: string) {
  return /^[aeiouhàâäéèêëîïôöûüœ]/i.test(name) ? `d'${name}` : `de ${name}`;
}

// « Message de Karim », « Message d'Atlas Études »
export function messageFrom(name: string) {
  return `Message ${ofName(name)}`;
}

// Début du message, sur une ligne
export function preview(text: string, max = PREVIEW_LENGTH) {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
}

export function studentMessagePush(caseId: string, studentName: string, body: string): PushPayload {
  return {
    title: messageFrom(studentName),
    body: preview(body),
    url: `/cases/${caseId}/messages`,
    tag: `message-${caseId}`,
  };
}

export function studentReviewPush(
  caseId: string,
  studentName: string,
  review: { decision: "approved" } | { decision: "changes_requested"; message: string },
): PushPayload {
  return review.decision === "approved"
    ? {
        title: `${studentName} a tout validé`,
        body: "Sa lettre de motivation et ses formations sont validées.",
        url: `/cases/${caseId}`,
        tag: `review-${caseId}`,
      }
    : {
        title: `${studentName} demande une modification`,
        body: preview(review.message),
        url: `/cases/${caseId}/messages`,
        tag: `review-${caseId}`,
      };
}

export function assignedTaskPush(
  caseId: string,
  task: { id: string; title: string },
  by: string,
  studentName: string,
): PushPayload {
  return {
    title: `Tâche confiée par ${by}`,
    body: preview(`${task.title} · ${studentName}`),
    url: `/cases/${caseId}/tasks`,
    tag: `task-${task.id}`,
  };
}

// Même tâche pour plusieurs dossiers (mode sélection de l'arbre) : une
// seule notification, vers la page Tâches
export function assignedTasksPush(title: string, by: string, count: number): PushPayload {
  return {
    title: `Tâche confiée par ${by}`,
    body: preview(`${title} · ${plural(count, "dossier")}`),
    url: "/tasks",
    tag: `tasks-${Date.now()}`,
  };
}

// « 2 tâches pour aujourd'hui et 1 en retard »
export function taskDigestPush(dueToday: number, overdue: number): PushPayload {
  const parts = [
    dueToday > 0 && `${plural(dueToday, "tâche")} pour aujourd'hui`,
    overdue > 0 && (dueToday > 0 ? `${overdue} en retard` : `${plural(overdue, "tâche")} en retard`),
  ].filter(Boolean);
  return {
    title: "Vos tâches du jour",
    body: parts.join(" et "),
    url: "/tasks",
    tag: "task-digest",
  };
}

// Côté candidat
export function agencyMessagePush(agencyName: string, body: string): PushPayload {
  return {
    title: messageFrom(agencyName),
    body: preview(body),
    url: "/student/messages",
    tag: "message",
  };
}

// Essai : membre (vers Réglages) ou candidat (vers ses messages)
export function testPush(student = false): PushPayload {
  return student
    ? {
        title: "Notifications activées",
        body: "Vous serez prévenu ici des messages de votre agence.",
        url: "/student/messages",
        tag: "test",
      }
    : {
        title: "Notifications activées",
        body: "Cet appareil recevra les notifications choisies dans Réglages.",
        url: "/settings#notifications",
        tag: "test",
      };
}
