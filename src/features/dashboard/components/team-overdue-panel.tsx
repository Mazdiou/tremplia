import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Panel, StatusPill } from "@/components/page-ui";
import { dueLabel } from "@/features/tasks/due";
import { plural } from "@/lib/plural";
import type { MemberOverdue } from "@/features/tasks/server/read";

// Patron : qui a des tâches en retard, et depuis quand. Chaque ligne mène à
// ses tâches sur la page Tâches.
export function TeamOverduePanel({
  rows,
  memberNames,
  today,
}: {
  rows: MemberOverdue[];
  memberNames: Map<string, string>;
  today: string;
}) {
  return (
    <Panel title="Retards de l'équipe" description="Tâches en retard, campagnes actives.">
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
          Aucune tâche en retard dans l&apos;équipe.
        </p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li key={r.userId} className="border-b last:border-b-0">
              <Link
                href={`/tasks?qui=${r.userId}`}
                className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {memberNames.get(r.userId) ?? "Ancien membre"}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    La plus ancienne : {dueLabel(r.oldest, today)}
                  </span>
                </span>
                <StatusPill tone="bad">{plural(r.count, "tâche")}</StatusPill>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
