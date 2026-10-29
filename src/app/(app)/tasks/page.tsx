import { ListTodo } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-ui";
import { getShellUser } from "@/components/shell/app-shell";
import { listCampaigns } from "@/features/campaigns/server/queries";
import { STATUS_SUFFIXES } from "@/features/cases/labels";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { compareOpenTasks, dueState } from "@/features/tasks/due";
import { TasksFilters, TasksOverview, type TaskSection } from "@/features/tasks/components/tasks-overview";
import { taskItemMapper } from "@/features/tasks/server/items";
import { listAgencyTasks, listTaskMembers } from "@/features/tasks/server/read";
import { todayInAppTimezone } from "@/lib/dates";
import { displayName } from "@/lib/names";
import { plural } from "@/lib/plural";
import { isUuid } from "@/lib/validation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tâches" };

// Faites depuis 7 jours : affichées repliées en bas de page
const DONE_DAYS = 7;

// Tâches de tous les dossiers : les miennes par défaut, celles de l'équipe ou
// d'un membre au choix ; campagnes actives par défaut.
export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ qui?: string; campagne?: string }>;
}) {
  const [{ member }, members, campaigns, params] = await Promise.all([
    getShellUser(),
    listTaskMembers(),
    listCampaigns(),
    searchParams,
  ]);

  const who =
    params.qui === "equipe" || (params.qui && isUuid(params.qui) && members.some((m) => m.id === params.qui))
      ? params.qui
      : "moi";
  const campaign =
    params.campagne === "toutes" || campaigns.some((c) => c.id === params.campagne)
      ? (params.campagne as string)
      : "";
  const assignee = who === "moi" ? member.userId : who === "equipe" ? null : who;

  const today = todayInAppTimezone();
  const [readOnly, tasks] = await Promise.all([
    isReadOnly(member.agencyId),
    listAgencyTasks(assignee, DONE_DAYS).catch(() => null),
  ]);

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const inScope = (campaignId: string | undefined) => {
    const c = campaignId ? campaignById.get(campaignId) : undefined;
    if (!c) return false;
    if (campaign === "toutes") return true;
    if (campaign) return c.id === campaign;
    return c.status === "active";
  };

  const campaignLabel = (id: string) => {
    const c = campaignById.get(id);
    return c && (c.status === "active" ? c.name : `${c.name} (archivée)`);
  };

  const toItem = taskItemMapper(member, members);
  const toItems = (rows: NonNullable<typeof tasks>["open"]) =>
    rows
      .filter((r) => r.case && inScope(r.case.campaign_id))
      .map((r) => {
        const item = toItem(r);
        const c = r.case!;
        const suffix = STATUS_SUFFIXES[c.status];
        return {
          ...item,
          caseLabel: {
            name: displayName(c.first_name, c.last_name),
            detail: [campaignLabel(c.campaign_id), suffix && `dossier ${suffix}`]
              .filter(Boolean)
              .join(", "),
          },
        };
      });

  const open = tasks ? toItems(tasks.open).sort(compareOpenTasks) : [];
  const done = tasks ? toItems(tasks.done) : [];
  const byState = (state: ReturnType<typeof dueState>) =>
    open.filter((t) => dueState(t.dueDate, today) === state);
  const sections: TaskSection[] = [
    { key: "overdue", title: "En retard", tasks: byState("overdue"), tone: "bad" },
    { key: "today", title: "Aujourd'hui", tasks: byState("today"), tone: "warn" },
    { key: "week", title: "Cette semaine", tasks: byState("week") },
    { key: "later", title: "Plus tard", tasks: byState("later"), collapsed: true },
    { key: "none", title: "Sans échéance", tasks: byState("none"), collapsed: true },
    { key: "done", title: `Faites ces ${DONE_DAYS} derniers jours`, tasks: done, collapsed: true },
  ];

  const whoLabel =
    who === "moi" ? "Mes tâches" : who === "equipe" ? "Toute l'équipe" : members.find((m) => m.id === who)?.name;

  return (
    <PageContainer>
      <PageHeader
        title="Tâches"
        subtitle={tasks ? `${whoLabel}, ${plural(open.length, "tâche")} à faire` : whoLabel}
        actions={
          <TasksFilters
            who={who}
            campaign={campaign}
            members={members}
            campaigns={campaigns.map((c) => ({ id: c.id, name: c.name, archived: c.status !== "active" }))}
            currentUserId={member.userId}
          />
        }
      />

      {!tasks ? (
        <p role="alert" className="rounded-xl border px-4 py-3 text-sm text-destructive">
          Les tâches n&apos;ont pas pu être chargées. Rechargez la page.
        </p>
      ) : open.length === 0 && done.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title={who === "moi" ? "Aucune tâche pour vous" : "Aucune tâche"}
          description="Une tâche note ce qu'il reste à faire sur un dossier, et pour quand. Ajoutez-la depuis l'onglet Tâches du dossier, ou pour plusieurs dossiers à la fois avec la sélection de la liste."
        />
      ) : (
        <TasksOverview
          sections={sections}
          members={members}
          currentUserId={member.userId}
          today={today}
          readOnly={readOnly}
          showAssignee={who === "equipe"}
        />
      )}
    </PageContainer>
  );
}
