"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusMessage, StatusPill, type ActionMessage } from "@/components/page-ui";
import { WhatsAppMenu, type WhatsAppMenuContext } from "@/features/whatsapp/components/whatsapp-menu";
import {
  BALANCE_SORTS,
  PERIODS,
  overviewQuery,
  type BalanceRow,
  type OverviewFilters,
} from "@/features/payments/overview";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABELS } from "@/features/payments/schemas";
import type { TaskMember } from "@/features/tasks/types";
import { formatShortDate } from "@/lib/dates";
import { formatDA } from "@/lib/money";
import { PaymentForm } from "./payments-panel";

// Téléphone : deux filtres par ligne ; ordinateur : sur une ligne
const selectClass =
  "h-10 w-full min-w-0 rounded-lg border bg-card px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto";

// Membres proposés dans un filtre : les actifs, plus celui déjà choisi
function memberOptions(members: TaskMember[], current: string) {
  return members
    .filter((m) => m.isActive || m.id === current)
    .map((m) => (
      <option key={m.id} value={m.id}>
        {m.name}
        {m.isActive ? "" : " (désactivé)"}
      </option>
    ));
}

// Filtres de la vue affichée. Chaque choix change l'adresse de la page, qui
// relit les données (et que l'export reprend).
export function OverviewFiltersBar({
  filters,
  periodFrom,
  periodTo,
  today,
  campaigns,
  members,
}: {
  filters: OverviewFilters;
  // Dates de la période affichée : point de départ des « Dates au choix »
  periodFrom: string | null;
  periodTo: string | null;
  today: string;
  campaigns: { id: string; name: string; archived: boolean }[];
  members: TaskMember[];
}) {
  const router = useRouter();
  const go = (change: Partial<OverviewFilters>) => {
    const query = overviewQuery({ ...filters, ...change });
    router.push(query ? `/payments?${query}` : "/payments");
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center" role="group" aria-label="Filtres">
      {filters.view === "encaissements" && (
        <>
          <select
            aria-label="Période"
            value={filters.period}
            onChange={(e) => {
              const period = e.target.value as OverviewFilters["period"];
              if (period !== "dates") return go({ period });
              // Dates au choix : on part de la période affichée
              go({ period, from: periodFrom ?? `${today.slice(0, 7)}-01`, to: periodTo ?? today });
            }}
            className={selectClass}
          >
            {PERIODS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {filters.period === "dates" && (
            <span className="col-span-2 flex items-center gap-2">
              <input
                type="date"
                aria-label="Du"
                value={filters.from}
                max={filters.to}
                onChange={(e) => e.target.value && go({ from: e.target.value })}
                className={selectClass}
              />
              <span className="text-sm text-muted-foreground">au</span>
              <input
                type="date"
                aria-label="Au"
                value={filters.to}
                min={filters.from}
                onChange={(e) => e.target.value && go({ to: e.target.value })}
                className={selectClass}
              />
            </span>
          )}
          <select
            aria-label="Moyen de paiement"
            value={filters.method}
            onChange={(e) => go({ method: e.target.value })}
            className={selectClass}
          >
            <option value="">Tous les moyens</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_METHOD_LABELS[m]}
              </option>
            ))}
          </select>
          <select
            aria-label="Enregistré par"
            value={filters.recordedBy}
            onChange={(e) => go({ recordedBy: e.target.value })}
            className={selectClass}
          >
            <option value="">Toute l&apos;équipe</option>
            {memberOptions(members, filters.recordedBy)}
          </select>
        </>
      )}
      {filters.view === "restes" && (
        <>
          <select
            aria-label="Responsable"
            value={filters.responsible}
            onChange={(e) => go({ responsible: e.target.value })}
            className={selectClass}
          >
            <option value="">Tous les responsables</option>
            <option value="aucun">Sans responsable</option>
            {memberOptions(members, filters.responsible)}
          </select>
          <select
            aria-label="Trier par"
            value={filters.sort}
            onChange={(e) => go({ sort: e.target.value as OverviewFilters["sort"] })}
            className={selectClass}
          >
            {BALANCE_SORTS.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </>
      )}
      <select
        aria-label="Campagne"
        value={filters.campaign}
        onChange={(e) => go({ campaign: e.target.value })}
        className={selectClass}
      >
        <option value="">Campagnes actives</option>
        <option value="toutes">Toutes, archivées comprises</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.archived ? " (archivée)" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

// Restes à payer : une ligne par candidat, avec « Encaisser » (formulaire
// du dossier, sans quitter la page) et le rappel WhatsApp
export function BalanceList({
  rows,
  readOnly,
  agency,
}: {
  rows: BalanceRow[];
  // Abonnement expiré : consultation seulement
  readOnly: boolean;
  agency: { name: string; phone: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [message, setMessage] = useState<ActionMessage>(null);

  return (
    <div className="space-y-2">
      <StatusMessage message={message} />
      {/* Sans overflow-hidden : le menu WhatsApp dépasse de la liste */}
      <ul className="divide-y rounded-xl border bg-card">
        {rows.map((r) => {
          const percent = Math.min(100, Math.floor((r.paid / r.agreed) * 100));
          const context: WhatsAppMenuContext = {
            candidate: r.firstName,
            agencyName: agency.name,
            agencyPhone: agency.phone,
            accessCode: null,
            remaining: r.remaining,
          };
          return (
            <li key={r.caseId} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-56">
                  <Link
                    href={`/cases/${r.caseId}/payments`}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {r.candidate}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {[r.campaign, r.responsible ?? "Sans responsable"].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="w-44 max-sm:order-last max-sm:w-full">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Payé {formatDA(r.paid)} sur {formatDA(r.agreed)}
                  </p>
                  <div
                    role="progressbar"
                    aria-label={`Part payée par ${r.candidate}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.lastPaidOn ? `Dernier paiement le ${formatShortDate(r.lastPaidOn)}` : "Aucun paiement"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1 max-sm:w-full sm:ml-auto">
                  <StatusPill tone="warn">Reste {formatDA(r.remaining)}</StatusPill>
                  <WhatsAppMenu phone={r.phone} recipient={r.candidate} context={context} align="end" />
                  {!readOnly && open !== r.caseId && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="max-sm:ml-auto"
                      onClick={() => {
                        setMessage(null);
                        setOpen(r.caseId);
                      }}
                      aria-label={`Encaisser un paiement de ${r.candidate}`}
                    >
                      <Banknote /> Encaisser
                    </Button>
                  )}
                </div>
              </div>
              {open === r.caseId && (
                <div className="mt-3">
                  <PaymentForm
                    caseId={r.caseId}
                    remaining={r.remaining}
                    onDone={(text) => {
                      setOpen(null);
                      setMessage({ text: `${text} (${r.candidate})`, error: false });
                      router.refresh();
                    }}
                    onCancel={() => setOpen(null)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
