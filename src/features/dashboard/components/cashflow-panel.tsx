import Link from "next/link";
import { Wallet } from "lucide-react";
import { Panel } from "@/components/page-ui";
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

// Encaissements des six derniers mois : une barre par mois, sur une même
// échelle. En tête, le total et la moyenne de la période (le mois en cours
// est déjà dans le widget Paiements) ; montant de chaque mois au survol ;
// tableau équivalent pour les lecteurs d'écran.
export function CashflowPanel({ months, href }: { months: CashMonth[]; href: string }) {
  const max = Math.max(...months.map((m) => m.amount));
  const total = months.reduce((n, m) => n + m.amount, 0);

  return (
    <Panel
      title="Encaissements par mois"
      description="Six derniers mois, paiements annulés exclus."
      actions={
        <Link
          href={href}
          className="touch-target inline-flex items-center gap-1.5 text-xs font-medium text-link underline-offset-2 hover:underline"
        >
          <Wallet className="size-3.5" aria-hidden /> Détail
        </Link>
      }
    >
      <div className="px-5 py-4">
        <p className="text-sm text-muted-foreground">
          Depuis {longMonth.format(new Date(months[0].month))}
        </p>
        <p className="text-xl font-semibold tracking-tight tabular-nums">{formatDA(total)}</p>
        <p className="text-xs text-muted-foreground">
          {formatDA(Math.round(total / months.length))} par mois en moyenne
        </p>

        {total === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Aucun paiement enregistré sur cette période.
          </p>
        ) : (
          <div className="mt-4" aria-hidden>
            <div className="flex h-28 items-end gap-2 border-b">
              {months.map((m, i) => (
                <div key={m.month} className="group relative flex h-full flex-1 items-end justify-center">
                  <div
                    className="w-full max-w-10 rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
                    style={{
                      // Un mois avec des paiements reste visible, même petit
                      height: m.amount > 0 ? `max(${(m.amount / max) * 100}%, 3px)` : 0,
                    }}
                  />
                  <div
                    className={cn(
                      "pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-lg border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block",
                      // Aux extrémités : collée au bord, pour ne pas sortir du cadre
                      i === 0 ? "left-0" : i === months.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2",
                    )}
                  >
                    <span className="block font-medium first-letter:uppercase">
                      {longMonth.format(new Date(m.month))}
                    </span>
                    <span className="tabular-nums">{formatDA(m.amount)}</span>
                    <span className="text-muted-foreground"> · {plural(m.payments, "paiement")}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2">
              {months.map((m) => (
                <span key={m.month} className="flex-1 text-center text-xs text-muted-foreground">
                  {shortMonth.format(new Date(m.month))}
                </span>
              ))}
            </div>
          </div>
        )}

        <table className="sr-only">
          <caption>Encaissements par mois</caption>
          <thead>
            <tr>
              <th scope="col">Mois</th>
              <th scope="col">Montant</th>
              <th scope="col">Paiements</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <th scope="row">{longMonth.format(new Date(m.month))}</th>
                <td>{formatDA(m.amount)}</td>
                <td>{m.payments}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
