import Link from "next/link";
import { redirect } from "next/navigation";
import { Banknote, Wallet } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-ui";
import { getAgency } from "@/features/agency/server/get-agency";
import { ExcelDownloadButton } from "@/features/export/components/export-campaign-button";
import { CollectionList } from "@/features/payments/components/collection-list";
import { BalanceList, OverviewFiltersBar } from "@/features/payments/components/payments-overview";
import {
  balanceTotals,
  collectionTotals,
  firstDays,
  groupByDay,
  overviewQuery,
  type OverviewFilters,
} from "@/features/payments/overview";
import { loadPaymentsOverview } from "@/features/payments/server/overview";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { requirePermission } from "@/lib/auth/require-member";
import { formatDA } from "@/lib/money";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Paiements" };

// Lignes affichées au plus (les totaux et l'export portent sur tout)
const MAX_ROWS = 300;

function Figure({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card px-5 py-4", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

// Les deux vues, comme des onglets : le filtre de campagne est gardé
function ViewTabs({ filters }: { filters: OverviewFilters }) {
  const tabs = [
    ["encaissements", "Encaissements"],
    ["restes", "Restes à payer"],
  ] as const;
  return (
    <nav aria-label="Vues des paiements" className="flex gap-1 rounded-xl border bg-muted/40 p-1 sm:w-fit">
      {tabs.map(([view, label]) => {
        const active = filters.view === view;
        const query = overviewQuery({ ...filters, view });
        return (
          <Link
            key={view}
            href={query ? `/payments?${query}` : "/payments"}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-1 rounded-lg px-4 py-1.5 text-center text-sm whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "bg-card font-medium text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

// Tous les paiements de l'agence (permission « Voir la caisse », comme les
// chiffres de paiement du tableau de bord) : ce qui est entré, et ce qui
// reste dû.
// L'enregistrement et l'annulation restent ceux de l'onglet Paiements du
// dossier (« Encaisser » ouvre le même formulaire).
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const member = await requirePermission("payments_view");
  if (!member) redirect("/dashboard");

  const [data, readOnly, agency] = await Promise.all([
    searchParams.then(loadPaymentsOverview).catch(() => null),
    isReadOnly(member.agencyId),
    getAgency(member.agencyId),
  ]);

  if (!data) {
    return (
      <PageContainer>
        <PageHeader title="Paiements" />
        <p role="alert" className="rounded-xl border px-4 py-3 text-sm text-destructive">
          Les paiements n&apos;ont pas pu être chargés. Rechargez la page.
        </p>
      </PageContainer>
    );
  }

  const { filters, period } = data;
  const query = overviewQuery(filters);
  const collections = data.collections ?? [];
  const balances = data.balances ?? [];
  const rowCount = filters.view === "encaissements" ? collections.length : balances.length;

  const filtersBar = (
    <OverviewFiltersBar
      filters={filters}
      periodFrom={period.from}
      periodTo={period.to}
      today={data.today}
      campaigns={data.campaigns.map((c) => ({ id: c.id, name: c.name, archived: c.status !== "active" }))}
      members={data.members}
    />
  );

  return (
    <PageContainer>
      <PageHeader
        title="Paiements"
        subtitle={
          member.isOwner
            ? "Tous les paiements de l'agence · visible par vous et les membres autorisés"
            : "Tous les paiements de l'agence · accès accordé par le patron"
        }
        actions={
          rowCount > 0 && (
            <ExcelDownloadButton url={query ? `/api/payments/export?${query}` : "/api/payments/export"} />
          )
        }
      />

      <div className="space-y-3">
        <ViewTabs filters={filters} />
        {filtersBar}
      </div>

      {data.noCampaign ? (
        filters.campaign === "toutes" ? (
          <EmptyState
            icon={Wallet}
            title="Aucune campagne"
            description="Les paiements apparaîtront ici dès que vos dossiers en auront."
          />
        ) : (
          <EmptyState
            icon={Wallet}
            title="Aucune campagne active"
            description="Choisissez « Toutes, archivées comprises » dans le filtre de campagne pour voir les paiements des campagnes archivées."
          />
        )
      ) : filters.view === "encaissements" ? (
        <Collections rows={collections} periodLabel={period.label} method={filters.method} />
      ) : (
        <Balances
          rows={balances}
          readOnly={readOnly}
          agency={{ name: agency?.name ?? "", phone: agency?.phone ?? "" }}
        />
      )}
    </PageContainer>
  );
}

function Collections({
  rows,
  periodLabel,
  method,
}: {
  rows: NonNullable<Awaited<ReturnType<typeof loadPaymentsOverview>>["collections"]>;
  periodLabel: string;
  // Un seul moyen choisi : le total suffit
  method: string;
}) {
  const totals = collectionTotals(rows);
  const shown = firstDays(groupByDay(rows), MAX_ROWS);
  return (
    <>
      <section aria-label="Totaux" className="space-y-2">
        <div className={cn("grid gap-3", !method && "md:grid-cols-[1fr_3fr]")}>
          <Figure
            label={`Encaissé · ${periodLabel}`}
            value={formatDA(totals.total)}
            hint={plural(totals.count, "paiement")}
            className="border-primary/40 bg-highlight"
          />
          {/* Par moyen : une ligne chacun sur téléphone, côte à côte ensuite */}
          {!method && (
            <dl
              aria-label="Par moyen de paiement"
              className="grid divide-y rounded-2xl border bg-card sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0"
            >
              {totals.byMethod.map((m) => (
                <div
                  key={m.method}
                  className="flex items-baseline justify-between gap-3 px-5 py-2.5 sm:block sm:py-4"
                >
                  <dt className="text-sm text-muted-foreground">{m.label}</dt>
                  <dd className="text-right sm:mt-1 sm:text-left">
                    <span className="font-semibold tabular-nums sm:text-xl sm:tracking-tight">
                      {formatDA(m.amount)}
                    </span>
                    <span className="block text-xs text-muted-foreground sm:mt-0.5">
                      {plural(m.count, "paiement")}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        {totals.cancelledCount > 0 && (
          <p className="px-1 text-xs text-muted-foreground">
            {plural(totals.cancelledCount, "paiement annulé", "paiements annulés")} sur la période :
            affichés barrés, non comptés.
          </p>
        )}
      </section>

      {rows.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Aucun encaissement sur cette période"
          description="Les paiements s'enregistrent dans l'onglet Paiements de chaque dossier, ou avec « Encaisser » dans la vue Restes à payer."
        />
      ) : (
        <>
          <CollectionList days={shown.days} />
          {shown.rows < rows.length && (
            <p className="px-1 text-sm text-muted-foreground">
              {shown.rows} paiements affichés sur {rows.length}. Les totaux et l&apos;export Excel
              portent sur toute la période.
            </p>
          )}
        </>
      )}
    </>
  );
}

function Balances({
  rows,
  readOnly,
  agency,
}: {
  rows: NonNullable<Awaited<ReturnType<typeof loadPaymentsOverview>>["balances"]>;
  readOnly: boolean;
  agency: { name: string; phone: string };
}) {
  const totals = balanceTotals(rows);
  const shown = rows.slice(0, MAX_ROWS);
  return (
    <>
      <section aria-label="Totaux" className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Figure
          label="Reste à encaisser"
          value={formatDA(totals.remaining)}
          hint={plural(totals.cases, "candidat")}
          className="col-span-2 border-primary/40 bg-highlight md:col-span-1"
        />
        <Figure
          label="Déjà encaissé sur ces dossiers"
          value={formatDA(rows.reduce((n, r) => n + r.paid, 0))}
          hint={`sur ${formatDA(rows.reduce((n, r) => n + r.agreed, 0))} convenus`}
        />
        <Figure
          label="Rien payé encore"
          value={String(totals.neverPaid)}
          hint={totals.neverPaid > 1 ? "candidats" : "candidat"}
        />
      </section>

      {rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="Aucun reste à payer"
          description="Tous les candidats de ces dossiers ont réglé ce qui était convenu."
        />
      ) : (
        <>
          <BalanceList rows={shown} readOnly={readOnly} agency={agency} />
          {shown.length < rows.length && (
            <p className="px-1 text-sm text-muted-foreground">
              {shown.length} candidats affichés sur {rows.length}. Les totaux et l&apos;export Excel
              portent sur tous.
            </p>
          )}
        </>
      )}
      <p className="px-1 text-xs text-muted-foreground">
        Dossiers abandonnés et dossiers sans montant convenu non compris.
      </p>
    </>
  );
}
