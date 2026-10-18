import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { getCase } from "@/features/cases/server/get-case";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { todayInAppTimezone } from "@/lib/dates";
import { compareOpenTasks } from "@/features/tasks/due";
import { TasksPanel } from "@/features/tasks/components/tasks-panel";
import { taskItemMapper } from "@/features/tasks/server/items";
import { listCaseTasks, listTaskMembers } from "@/features/tasks/server/read";

export default async function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, caller] = await Promise.all([getCase(id), requireMember()]);
  if (!data || !caller) notFound();

  const [{ open, done, doneTotal }, members, readOnly] = await Promise.all([
    listCaseTasks(id),
    listTaskMembers(),
    isReadOnly(caller.agencyId),
  ]);
  const toItem = taskItemMapper(caller, members);
  const withCase = <T,>(r: T) => ({ ...r, case_id: id });

  return (
    <TasksPanel
      context={{ caseId: id, members, currentUserId: caller.userId, today: todayInAppTimezone() }}
      open={open.map(withCase).map(toItem).sort(compareOpenTasks)}
      done={done.map(withCase).map(toItem)}
      doneTotal={doneTotal}
      readOnly={readOnly}
    />
  );
}
