import { Panel, PanelLink } from "@/components/page-ui";
import { countdownLabel, type TimelineItem } from "@/features/campaigns/timeline";
import { formatLongDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

// Prochaines échéances d'une campagne (vue d'une seule campagne : sinon,
// chaque carte de campagne montre déjà la sienne)
export function DeadlinesPanel({
  items,
  campaignId,
}: {
  items: TimelineItem[];
  campaignId: string;
}) {
  const upcoming = items.filter((d) => d.days >= 0).slice(0, 4);
  return (
    <Panel
      title="Prochaines échéances"
      actions={<PanelLink href={`/campaigns/${campaignId}`}>Toutes les dates</PanelLink>}
    >
      {upcoming.length === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">Aucune échéance à venir.</p>
      ) : (
        <ul>
          {upcoming.map((d, i) => (
            <li
              key={`${d.label}-${d.date}`}
              className="flex items-center gap-3 border-b px-5 py-3 text-sm last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate", i === 0 && "font-semibold")}>{d.label}</span>
                <span className="block text-xs text-muted-foreground">{formatLongDate(d.date)}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
                )}
              >
                {countdownLabel(d.days)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
