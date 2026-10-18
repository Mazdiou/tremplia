import "server-only";
import { dayFormat } from "@/lib/dates";
import type { Member } from "@/lib/auth/require-member";
import type { TaskRow } from "@/features/tasks/server/read";
import type { TaskItem, TaskMember } from "@/features/tasks/types";

// Ligne de la base → tâche affichée, avec les droits de l'appelant (affichage
// seulement : la base applique les vraies règles)
export function taskItemMapper(caller: Member, members: TaskMember[]) {
  const names = new Map(members.map((m) => [m.id, m.isActive ? m.name : `${m.name} (désactivé)`]));
  const nameOf = (userId: string | null) => (userId && names.get(userId)) || "un ancien membre";

  return (r: TaskRow & { case_id: string }): TaskItem => {
    const creator = r.created_by === caller.userId;
    return {
      id: r.id,
      caseId: r.case_id,
      title: r.title,
      details: r.details,
      dueDate: r.due_date,
      assignedTo: r.assigned_to,
      assigneeName: nameOf(r.assigned_to),
      creatorName: r.created_by !== r.assigned_to ? nameOf(r.created_by) : null,
      createdAt: r.created_at,
      doneLabel: r.done_at
        ? `Faite par ${r.done_by === caller.userId ? "moi" : nameOf(r.done_by)}, le ${dayFormat.format(new Date(r.done_at))}`
        : null,
      canEdit: caller.isOwner || creator || r.assigned_to === caller.userId,
      canDelete: caller.isOwner || creator,
    };
  };
}
