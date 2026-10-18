import Link from "next/link";
import { Panel } from "@/components/page-ui";
import { activityActor, activityLabel } from "@/features/history/labels";
import type { ActivityEntry } from "../server/dashboard";
import { Initials, relativeWhen } from "./dashboard-ui";
import { fullName } from "@/lib/names";

// Activité récente de l'agence (patron) : qui a fait quoi, sur quel dossier
// ou quelle campagne ; les répétitions sont regroupées (« · 6 fois »).
export function ActivityPanel({ entries }: { entries: ActivityEntry[] }) {
  return (
    <Panel
      title="Activité récente de l'agence"
      description="Visible par le patron seulement."
      className="max-md:hidden"
    >
      {entries.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">Aucune activité enregistrée.</p>
      ) : (
        <ul>
          {entries.map((a) => (
            <li key={a.id} className="flex items-center gap-3 border-b px-5 py-2.5 text-sm last:border-b-0">
              <Initials first={a.actor?.first_name ?? "?"} last={a.actor?.last_name ?? ""} />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium">
                  {activityActor(a.action, a.actor && fullName(a.actor.first_name, a.actor.last_name), "agency")}
                </span>{" "}
                <span className="text-muted-foreground">{activityLabel(a.action, "agency")}</span>
                {a.object && (
                  <>
                    <span className="text-muted-foreground"> · </span>
                    {a.object.href ? (
                      <Link href={a.object.href} className="font-medium hover:text-link hover:underline">
                        {a.object.label}
                      </Link>
                    ) : (
                      <span className="font-medium">{a.object.label}</span>
                    )}
                  </>
                )}
                {a.count > 1 && (
                  <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
                    {a.count} fois
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{relativeWhen(a.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
