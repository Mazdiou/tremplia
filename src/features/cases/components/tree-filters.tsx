"use client";

import type { RefObject } from "react";
import { AlarmClock, ListFilter, Search, X } from "lucide-react";
import { EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS } from "@/features/cases/labels";
import { fullName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { useUiPrefs, type UiPrefs } from "@/lib/ui-prefs";
import type { stageFilterOptions } from "@/features/stages/stages";
import type { TreeMember } from "./case-tree";

// Haut du panneau des dossiers : réglages d'affichage, recherche, filtres.
// Réglages et filtres sont mémorisés dans les préférences de l'interface.

const selectClass =
  "h-8 min-w-0 flex-1 rounded-lg border bg-card px-2 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// Réglages d'affichage (bouton à côté du nom de l'application)
const DISPLAY_OPTIONS = [
  { key: "showLevel", label: "Afficher le niveau d'études" },
  { key: "showPayments", label: "Afficher le reste à payer" },
  { key: "showStage", label: "Afficher l'étape" },
  { key: "showClosed", label: "Afficher clos et abandonnés" },
  { key: "showArchived", label: "Afficher les campagnes archivées" },
] as const satisfies readonly { key: keyof UiPrefs; label: string }[];

export function TreeDisplaySettings() {
  const [prefs, setPrefs] = useUiPrefs();
  return (
    <div className="absolute top-12 right-3 left-3 z-20 space-y-2 rounded-xl border bg-popover p-3 text-sm shadow-lg">
      {DISPLAY_OPTIONS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={prefs[key]}
            onChange={(e) => setPrefs({ [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
      <label className="flex items-center justify-between gap-2">
        Trier par
        <select
          value={prefs.sortBy}
          onChange={(e) => setPrefs({ sortBy: e.target.value as UiPrefs["sortBy"] })}
          className={cn(selectClass, "max-w-36 flex-none")}
        >
          <option value="name">Nom</option>
          <option value="level">Niveau d&apos;études</option>
        </select>
      </label>
    </div>
  );
}

export function TreeSearchBox({
  query,
  onChange,
  inputRef,
}: {
  query: string;
  onChange: (query: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="px-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onChange("");
          }}
          placeholder="Rechercher un candidat"
          aria-label="Rechercher un candidat dans toutes les campagnes"
          className="h-10 w-full rounded-lg border bg-card pr-16 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {!query && (
          <kbd className="pointer-events-none absolute top-2.5 right-2.5 rounded-md border px-1.5 text-[0.6875rem] text-muted-foreground max-md:hidden">
            Ctrl K
          </kbd>
        )}
        {query && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            aria-label="Effacer la recherche"
            className="absolute top-2.5 right-2.5 grid size-5 place-items-center rounded text-muted-foreground hover:bg-muted"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export function TreeFilters({
  counts,
  stageOptions,
  responsibles,
  hasOverdue,
}: {
  // Dossiers actifs (tous / les miens) ; null tant que tout n'est pas chargé
  counts: { all: number; mine: number } | null;
  stageOptions: ReturnType<typeof stageFilterOptions>;
  responsibles: TreeMember[];
  // Au moins un dossier a une tâche en retard
  hasOverdue: boolean;
}) {
  const [prefs, setPrefs] = useUiPrefs();
  // Filtres repliés derrière un bouton ; le nombre de filtres actifs reste visible
  const activeCount = [
    prefs.level,
    prefs.payment,
    prefs.stage,
    prefs.overdue,
    !prefs.mine && prefs.responsible,
  ].filter(Boolean).length;
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex gap-1.5">
        <div
          role="group"
          aria-label="Portée des dossiers"
          className="flex min-w-0 flex-1 rounded-xl bg-muted p-[3px]"
        >
          {[
            { mine: false, label: "Tous", n: counts?.all },
            { mine: true, label: "Mes dossiers", n: counts?.mine },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={prefs.mine === opt.mine}
              onClick={() => setPrefs({ mine: opt.mine, responsible: "" })}
              className={cn(
                "h-8 min-w-0 flex-1 truncate rounded-[9px] px-2 text-sm transition-colors",
                prefs.mine === opt.mine
                  ? "bg-card font-medium text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}{" "}
              {opt.n !== undefined && <span className="tabular-nums">{opt.n}</span>}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPrefs({ filtersOpen: !prefs.filtersOpen })}
          aria-expanded={prefs.filtersOpen}
          aria-controls="tree-filters"
          aria-label={activeCount ? `Filtres, ${activeCount} actifs` : "Filtres"}
          title="Filtres"
          className={cn(
            "relative grid size-[38px] shrink-0 place-items-center rounded-xl border transition-colors",
            prefs.filtersOpen || activeCount
              ? "bg-card text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <ListFilter className="size-4" aria-hidden />
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-primary text-[0.625rem] font-medium text-primary-foreground tabular-nums">
              {activeCount}
            </span>
          )}
        </button>
      </div>
      {/* Deux filtres par ligne ; un seul si le panneau est très étroit */}
      {prefs.filtersOpen && (
        <div id="tree-filters" className="grid grid-cols-2 gap-1.5 pt-2 @max-[16rem]:grid-cols-1">
          <select
            value={prefs.level}
            onChange={(e) => setPrefs({ level: e.target.value })}
            aria-label="Filtrer par niveau d'études"
            className={selectClass}
          >
            <option value="">Tous niveaux</option>
            {EDUCATION_LEVELS.map((l) => (
              <option key={l} value={l}>
                {EDUCATION_LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
          <select
            value={prefs.payment}
            onChange={(e) => setPrefs({ payment: e.target.value as UiPrefs["payment"] })}
            aria-label="Filtrer par paiement"
            className={selectClass}
          >
            <option value="">Tous paiements</option>
            <option value="due">Reste à payer</option>
            <option value="paid">Soldés</option>
            <option value="unset">Montant à fixer</option>
          </select>
          {stageOptions.length > 0 && (
            <select
              value={prefs.stage}
              onChange={(e) => setPrefs({ stage: e.target.value })}
              aria-label="Filtrer par étape"
              className={selectClass}
            >
              <option value="">Toutes étapes</option>
              {stageOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.name}
                </option>
              ))}
              {prefs.stage && !stageOptions.some((o) => o.key === prefs.stage) && (
                <option value={prefs.stage}>{prefs.stage}</option>
              )}
            </select>
          )}
          {!prefs.mine && (
            <select
              value={prefs.responsible}
              onChange={(e) => setPrefs({ responsible: e.target.value })}
              aria-label="Filtrer par responsable"
              className={selectClass}
            >
              <option value="">Toute l&apos;équipe</option>
              {responsibles.map((m) => (
                <option key={m.id} value={m.id}>
                  {fullName(m.first_name, m.last_name)}
                  {m.is_active ? "" : " (désactivé)"}
                </option>
              ))}
            </select>
          )}
          {(prefs.overdue || hasOverdue) && (
            <button
              type="button"
              aria-pressed={prefs.overdue}
              onClick={() => setPrefs({ overdue: !prefs.overdue })}
              className={cn(
                "col-span-full flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors",
                prefs.overdue
                  ? "border-destructive/40 bg-destructive/10 font-medium text-destructive"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <AlarmClock className="size-4" aria-hidden />
              Tâches en retard
            </button>
          )}
        </div>
      )}
    </div>
  );
}
