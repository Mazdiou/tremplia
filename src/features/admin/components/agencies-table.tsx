"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { MetaList, StatusPill } from "@/components/page-ui";
import { Input } from "@/components/ui/input";
import {
  STATE_LABELS,
  STATE_TONES,
  formatEndDate,
  type SubscriptionState,
} from "@/features/subscription/subscription";
import { normalizeName as normalize } from "@/lib/names";
import { GiftButton, PaymentButton } from "./payment-dialog";
import { plural } from "@/lib/plural";

type AgencyRow = {
  id: string;
  name: string;
  city: string;
  ownerName: string;
  endsAt: string;
  state: SubscriptionState;
  cases: number;
};

// Liste des agences : filtre par état, recherche (nom, ville, patron)
export function AgenciesTable({ agencies }: { agencies: AgencyRow[] }) {
  const [state, setState] = useState<"" | SubscriptionState>("");
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const shown = agencies.filter(
    (a) =>
      (!state || a.state === state) &&
      (!q || normalize(`${a.name} ${a.city} ${a.ownerName}`).includes(q)),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="agency-state">
          État
        </label>
        <select
          id="agency-state"
          value={state}
          onChange={(e) => setState(e.target.value as "" | SubscriptionState)}
          className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm"
        >
          <option value="">Toutes</option>
          <option value="trial">Essai</option>
          <option value="active">Actives</option>
          <option value="expired">Expirées</option>
        </select>
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Rechercher une agence"
            placeholder="Rechercher (agence, ville, patron)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Aucune agence ne correspond.
        </p>
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {shown.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 basis-56">
                <Link href={`/admin/${a.id}`} className="font-medium hover:underline">
                  {a.name}
                </Link>
                <p className="truncate text-sm text-muted-foreground">
                  <MetaList items={[a.city, a.ownerName, plural(a.cases, "dossier")]} />
                </p>
              </div>
              <StatusPill tone={STATE_TONES[a.state]}>{STATE_LABELS[a.state]}</StatusPill>
              {a.state === "exempt" ? (
                <span className="text-sm text-muted-foreground">sans abonnement</span>
              ) : (
                <>
                  <span className="w-28 text-sm tabular-nums text-muted-foreground">
                    {a.state === "expired" ? "depuis le" : "jusqu'au"} {formatEndDate(a.endsAt)}
                  </span>
                  <GiftButton agency={a} variant="ghost" />
                  <PaymentButton agency={a} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
