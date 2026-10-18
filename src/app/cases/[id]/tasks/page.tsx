import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { getCase } from "@/features/cases/server/get-case";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { dayFormat, todayInAppTimezone } from "@/lib/dates";
import { compareOpenTasks } from "@/features/tasks/due";
import { TasksPanel } from "@/features/tasks/components/tasks-panel";
import { listCaseTasks, listTaskMembers, type TaskRow } from "@/features/tasks/server/read";
import type { TaskItem } from "@/features/tasks/types";

export default async function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, caller] = await Promise.all([getCase(id), requireMember()]);
  if (!data || !caller) notFound();

  const [{ open, done, doneTotal }, members, readOnly] = await Promise.all([
    listCaseTasks(id),
    listTaskMembers(),
    isReadOnly(caller.agencyId),
  ]);
  const names = new Map(members.map((m) => [m.id, m.isActive ? m.name : `${m.name} (désactivé)`]));
  const nameOf = (userId: string | null) => (userId && names.get(userId)) || "un ancien membre";

  const toItem = (r: TaskRow): TaskItem => {
    const creator = r.created_by === caller.userId;
    return {
      id: r.id,
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

  return (
    <TasksPanel
      context={{ caseId: id, members, currentUserId: caller.userId, today: todayInAppTimezone() }}
      open={open.map(toItem).sort(compareOpenTasks)}
      done={done.map(toItem)}
      doneTotal={doneTotal}
      readOnly={readOnly}
    />
  );
}
