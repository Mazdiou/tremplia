import Link from "next/link";
import { StatusPill } from "@/components/page-ui";
import type { groupByDay } from "@/features/payments/overview";
import { paymentMethodLabel } from "@/features/payments/schemas";
import { formatLongDate } from "@/lib/dates";
import { formatDA } from "@/lib/money";
import { cn } from "@/lib/utils";

const weekday = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", timeZone: "UTC" });

// Encaissements jour par jour, du plus récent au plus ancien, avec le total
// de chaque jour. Un paiement annulé reste visible, barré, hors du total.
export function CollectionList({ days }: { days: ReturnType<typeof groupByDay> }) {
  return (
    <div className="space-y-4">
      {days.map((d) => (
        <section key={d.day} aria-label={formatLongDate(d.day)} className="space-y-1.5">
          <h2 className="flex items-baseline justify-between gap-3 px-1 text-sm">
            <span className="font-medium first-letter:uppercase">
              {weekday(d.day)} {formatLongDate(d.day)}
            </span>
            <span className="text-muted-foreground tabular-nums">{formatDA(d.total)}</span>
          </h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card">
            {d.rows.map((r) => {
              const cancelled = r.cancelReason !== null;
              return (
                <li
                  key={r.id}
                  className={cn("flex items-start gap-3 px-4 py-2.5", cancelled && "bg-muted/40")}
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/cases/${r.caseId}/payments`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {r.candidate}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {paymentMethodLabel(r.method)} · enregistré par {r.recordedBy}
                      {r.campaign && <> · {r.campaign}</>}
                    </p>
                    {r.note && <p className="mt-0.5 text-sm break-words">{r.note}</p>}
                    {cancelled && (
                      <p className="mt-0.5 text-sm break-words text-muted-foreground">
                        Annulé{r.cancelReason ? ` : ${r.cancelReason}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span
                      className={cn(
                        "font-semibold tabular-nums",
                        cancelled && "text-muted-foreground line-through",
                      )}
                    >
                      {formatDA(r.amount)}
                    </span>
                    {cancelled && <StatusPill tone="bad">Annulé</StatusPill>}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
