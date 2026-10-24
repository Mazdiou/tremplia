import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Panel, StatusPill } from "@/components/page-ui";
import { displayName } from "@/lib/names";
import { todayInAppTimezone } from "@/lib/dates";
import { plural } from "@/lib/plural";
import { daysBetween } from "../months";
import { STALE_DAYS, type Stale } from "../server/dashboard";
import { Initials } from "./dashboard-ui";

// Dossiers actifs auxquels personne de l'agence n'a touché depuis
// STALE_DAYS jours : à relancer avant qu'ils ne soient oubliés
export function StalePanel({
  stale,
  memberNames,
  currentUserId,
}: {
  stale: Stale;
  memberNames: Map<string, string>;
  currentUserId: string;
}) {
  const today = todayInAppTimezone();
  const others = stale.total - stale.rows.length;
  return (
    <Panel
      title="Dossiers sans nouvelles"
      description={`Aucune action de l'agence depuis ${STALE_DAYS} jours ou plus.`}
    >
      {stale.rows.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
          Tous les dossiers actifs ont avancé ces {STALE_DAYS} derniers jours.
        </p>
      ) : (
        <>
          <ul>
            {stale.rows.map((c) => {
              const days = daysBetween(todayInAppTimezone(new Date(c.last_activity_at)), today);
              const owner =
                c.assigned_to === currentUserId
                  ? "Vous en êtes responsable"
                  : c.assigned_to
                    ? (memberNames.get(c.assigned_to) ?? "Ancien membre")
                    : "Sans responsable";
              return (
                <li key={c.id} className="border-b last:border-b-0">
                  <Link
                    href={`/cases/${c.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/50"
                  >
                    <Initials first={c.first_name} last={c.last_name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {displayName(c.first_name, c.last_name)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {owner}
                      </span>
                    </span>
                    <StatusPill tone="warn">
                      <span className="sr-only">Rien depuis </span>
                      {plural(days, "jour")}
                    </StatusPill>
                  </Link>
                </li>
              );
            })}
          </ul>
          {others > 0 && (
            <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">
              Et {plural(others, "autre dossier", "autres dossiers")} dans ce cas.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}
