import Link from "next/link";
import { ChevronRight, ListTodo } from "lucide-react";
import { Panel, StatusPill } from "@/components/page-ui";
import { displayName } from "@/lib/names";
import { plural } from "@/lib/plural";
import { dueLabel, dueState } from "@/features/tasks/due";
import type { AgencyTaskRow } from "@/features/tasks/server/read";

// Pair : deux colonnes égales sur grand écran
const SHOWN = 6;

// Tableau de bord, sous « À traiter » : mes tâches les plus urgentes (deux
// colonnes sur grand écran), avec un lien vers la page Tâches. Pour le
// patron, les tâches en retard de toute l'équipe.
export function MyTasksPanel({
  rows,
  counts,
  teamOverdue,
  today,
}: {
  rows: AgencyTaskRow[];
  counts: { overdue: number; today: number };
  teamOverdue: number | null;
  today: string;
}) {
  const week = rows.filter((r) => dueState(r.due_date, today) === "week").length;
  const summary = [
    counts.overdue > 0 && { text: `${counts.overdue} en retard`, className: "font-medium text-destructive" },
    counts.today > 0 && {
      text: `${counts.today} aujourd'hui`,
      className: "font-medium text-amber-700 dark:text-amber-300",
    },
    week > 0 && { text: `${week} cette semaine`, className: "" },
  ].filter((x): x is { text: string; className: string } => Boolean(x));

  return (
    <Panel
      title="Mes tâches"
      description={
        summary.length > 0 ? (
          <span className="text-sm">
            {summary.map((s, i) => (
              <span key={s.text}>
                {i > 0 && " · "}
                <span className={s.className}>{s.text}</span>
              </span>
            ))}
          </span>
        ) : undefined
      }
      actions={
        <Link href="/tasks" className="touch-target text-xs whitespace-nowrap text-muted-foreground hover:text-foreground">
          Tout voir
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="flex items-center gap-3 px-5 py-5 text-sm text-muted-foreground">
          <ListTodo className="size-5 shrink-0" aria-hidden />
          Aucune tâche à faire. Ajoutez-en depuis l&apos;onglet Tâches d&apos;un dossier.
        </div>
      ) : (
        <>
          <ul className="grid gap-x-6 px-3 py-2 @3xl:grid-cols-2">
            {rows.slice(0, SHOWN).map((r) => {
              const state = dueState(r.due_date, today);
              return (
                // min-w-0 : dans la grille, un long intitulé se tronque au lieu
                // d'élargir la ligne
                <li key={r.id} className="min-w-0">
                  <Link
                    href={`/cases/${r.case_id}/tasks`}
                    className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{r.title}</span>
                      {r.case && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {displayName(r.case.first_name, r.case.last_name)}
                        </span>
                      )}
                    </span>
                    {r.due_date &&
                      (state === "overdue" ? (
                        <StatusPill tone="bad">{dueLabel(r.due_date, today)}</StatusPill>
                      ) : state === "today" ? (
                        <StatusPill tone="warn">Aujourd&apos;hui</StatusPill>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {dueLabel(r.due_date, today)}
                        </span>
                      ))}
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
          {rows.length > SHOWN && (
            <Link
              href="/tasks"
              className="block border-t px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              {plural(rows.length - SHOWN, "autre tâche", "autres tâches")}
            </Link>
          )}
        </>
      )}
      {teamOverdue !== null && teamOverdue > 0 && (
        <Link
          href="/tasks?qui=equipe"
          className="flex items-center justify-between gap-3 border-t px-5 py-2.5 text-sm hover:bg-muted/60"
        >
          <span>
            L&apos;équipe : <span className="font-medium text-destructive">{plural(teamOverdue, "tâche")} en retard</span>
          </span>
          <ChevronRight className="size-4 text-muted-foreground/60" aria-hidden />
        </Link>
      )}
    </Panel>
  );
}
