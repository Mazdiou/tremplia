import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import { MAX_OPEN_TASKS, type TaskInput } from "@/features/tasks/schemas";
import { notifyAssignedTask } from "@/features/notifications/server/events";

// Tâches d'un dossier. L'intitulé et la précision ne sont jamais écrits dans
// le journal ni dans les logs du serveur. Les droits (auteur, responsable,
// patron) sont appliqués par les fonctions SQL ; voir la migration case_tasks.

const ASSIGNEE_ERROR = "Ce membre ne peut pas recevoir de tâche (compte désactivé ?)";
const LIMIT_ERROR = `Ce dossier a déjà ${MAX_OPEN_TASKS} tâches à faire`;

// La tâche doit appartenir à ce dossier
async function assertTaskInCase(auth: AuthorizedCase, caseId: string, taskId: string) {
  const { data, error } = await auth.admin
    .from("case_tasks")
    .select("id")
    .eq("id", taskId)
    .eq("case_id", caseId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (error) throw dbError("tasks read", error);
  if (!data) throw new ApiError(404, "Tâche introuvable");
}

function taskParams(input: TaskInput) {
  return {
    p_title: input.title,
    p_details: input.details ?? null,
    p_due_date: input.dueDate ?? null,
    p_assigned_to: input.assignedTo,
  };
}

// Tout membre actif, pour lui-même ou un collègue actif
export async function createTask(auth: AuthorizedCase, caseId: string, input: TaskInput) {
  const { data, error } = await auth.admin.rpc("create_case_task", {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    ...taskParams(input),
  });
  if (error) {
    throw dbError("tasks create", error, {
      P0002: "Dossier introuvable",
      "22023": ASSIGNEE_ERROR,
      "23514": "Tâche invalide",
      "54000": LIMIT_ERROR,
    });
  }
  if (typeof data !== "string") throw new ApiError(500, "Impossible d'ajouter la tâche");

  await logCaseActivity(auth, caseId, {
    action: "task.created",
    targetType: "case_task",
    targetId: data,
    details: { assigned_to: input.assignedTo },
  });
  notifyAssignedTask(auth.member, caseId, { id: data, title: input.title, assignedTo: input.assignedTo });
  return data;
}

// Son auteur, son responsable, ou un patron
export async function updateTask(
  auth: AuthorizedCase,
  caseId: string,
  taskId: string,
  input: TaskInput,
) {
  // Contenu d'avant, comparé en mémoire seulement (jamais écrit au journal)
  const { data: before, error: readError } = await auth.admin
    .from("case_tasks")
    .select("title, details, due_date")
    .eq("id", taskId)
    .eq("case_id", caseId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (readError) throw dbError("tasks read", readError);
  if (!before) throw new ApiError(404, "Tâche introuvable");

  const { data: previous, error } = await auth.admin.rpc("update_case_task", {
    p_task_id: taskId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    ...taskParams(input),
  });
  if (error) {
    throw dbError("tasks update", error, {
      "42501": "Seuls l'auteur, le responsable ou le patron modifient cette tâche",
      P0002: "Tâche introuvable",
      "22023": ASSIGNEE_ERROR,
      "23514": "Tâche invalide",
    });
  }

  // Les deux lignes si l'intitulé, la précision ou l'échéance changent en
  // même temps que le responsable ; aucune si rien ne change
  const edited =
    before.title !== input.title ||
    (before.details ?? null) !== (input.details ?? null) ||
    (before.due_date ?? null) !== (input.dueDate ?? null);
  if (edited) {
    await logCaseActivity(auth, caseId, {
      action: "task.updated",
      targetType: "case_task",
      targetId: taskId,
    });
  }
  if (previous !== input.assignedTo) {
    await logCaseActivity(auth, caseId, {
      action: "task.assigned",
      targetType: "case_task",
      targetId: taskId,
      details: { from: previous as string, to: input.assignedTo },
    });
    notifyAssignedTask(auth.member, caseId, {
      id: taskId,
      title: input.title,
      assignedTo: input.assignedTo,
    });
  }
}

// Cocher « faite » ou rouvrir : son auteur, son responsable, ou un patron
export async function setTaskDone(
  auth: AuthorizedCase,
  caseId: string,
  taskId: string,
  done: boolean,
) {
  await assertTaskInCase(auth, caseId, taskId);
  const { data: changed, error } = await auth.admin.rpc("set_case_task_done", {
    p_task_id: taskId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_done: done,
  });
  if (error) {
    throw dbError("tasks done", error, {
      "42501": "Seuls l'auteur, le responsable ou le patron cochent cette tâche",
      P0002: "Tâche introuvable",
      "54000": LIMIT_ERROR,
    });
  }

  if (changed === true) {
    await logCaseActivity(auth, caseId, {
      action: done ? "task.completed" : "task.reopened",
      targetType: "case_task",
      targetId: taskId,
    });
  }
}

// Son auteur, ou un patron
export async function deleteTask(auth: AuthorizedCase, caseId: string, taskId: string) {
  await assertTaskInCase(auth, caseId, taskId);
  const { error } = await auth.admin.rpc("delete_case_task", {
    p_task_id: taskId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
  });
  if (error) {
    throw dbError("tasks delete", error, {
      "42501": "Seuls l'auteur ou le patron suppriment cette tâche",
      P0002: "Tâche introuvable",
    });
  }

  await logCaseActivity(auth, caseId, {
    action: "task.deleted",
    targetType: "case_task",
    targetId: taskId,
  });
}
