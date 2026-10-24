import Link from "next/link";
import { Wallet } from "lucide-react";
import { Panel, PanelLink } from "@/components/page-ui";
import { formatDA } from "@/lib/money";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import type { CashMonth } from "../server/dashboard";

const shortMonth = new Intl.DateTimeFormat("fr-FR", { month: "short", timeZone: "UTC" });
const longMonth = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// Dernier jour du mois (« 2026-10-01 » → « 2026-10-31 »)
function monthEnd(month: string) {
  const d = new Date(`${month}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}

// Encaissements des six derniers mois : une barre par mois, sur une même
// échelle. En tête, le total et la moyenne de la période (le mois en cours
// est déjà dans le widget Paiements). Chaque barre mène aux encaissements de
// son mois ; son montant s'affiche au survol ou au clavier, et son lien le
// dit aux lecteurs d'écran. En pleine largeur, le résumé passe à gauche.
export function CashflowPanel({
  months,
  href,
  monthHref,
}: {
  months: CashMonth[];
  href: string;
  monthHref: (from: string, to: string) => string;
}) {
  const max = Math.max(...months.map((m) => m.amount));
  const total = months.reduce((n, m) => n + m.amount, 0);

  return (
    <Panel
      title="Encaissements par mois"
      description="Six derniers mois, paiements annulés exclus."
      actions={
        <PanelLink href={href} icon={Wallet}>
          Détail
        </PanelLink>
      }
    >
      <div className="grid gap-4 px-5 py-4 @3xl:grid-cols-[13rem_minmax(0,1fr)] @3xl:items-end @3xl:gap-8">
        <div>
          <p className="text-sm text-muted-foreground">
            Depuis {longMonth.format(new Date(months[0].month))}
          </p>
          <p className="text-xl font-semibold tracking-tight tabular-nums">{formatDA(total)}</p>
          <p className="text-xs text-muted-foreground">
            {formatDA(Math.round(total / months.length))} par mois en moyenne
          </p>
        </div>

        {total === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun paiement enregistré sur cette période.</p>
        ) : (
          <ol className="flex h-36">
            {months.map((m, i) => {
              const label = longMonth.format(new Date(m.month));
              return (
                <li key={m.month} className="flex-1">
                  <Link
                    href={monthHref(m.month, monthEnd(m.month))}
                    aria-label={`${label} : ${formatDA(m.amount)}, ${plural(m.payments, "paiement")}`}
                    className="group relative flex h-full flex-col items-center rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span aria-hidden className="flex w-full flex-1 items-end justify-center border-b px-1">
                      <span
                        className="w-full max-w-10 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
                        style={{
                          // Un mois avec des paiements reste visible, même petit
                          height: m.amount > 0 ? `max(${(m.amount / max) * 100}%, 3px)` : 0,
                        }}
                      />
                    </span>
                    <span aria-hidden className="mt-1.5 text-xs text-muted-foreground">
                      {shortMonth.format(new Date(m.month))}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block group-focus-visible:block",
                        // Aux extrémités : collée au bord, pour ne pas sortir du cadre
                        i === 0 ? "left-0" : i === months.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                      )}
                    >
                      <span className="block font-medium first-letter:uppercase">{label}</span>
                      <span className="tabular-nums">{formatDA(m.amount)}</span>
                      <span className="text-muted-foreground"> · {plural(m.payments, "paiement")}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </Panel>
  );
}
