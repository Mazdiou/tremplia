"use client";

import Link from "next/link";
import { EDUCATION_LEVEL_LABELS, STATUS_SUFFIXES, labelOf } from "@/features/cases/labels";
import { searchStatusLabel, useCaseSearch } from "@/features/cases/use-case-search";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";

// Résultats de la recherche globale, à la place de l'arbre (voir useCaseSearch)
export function TreeSearchResults({
  query,
  selectedId,
  showLevel,
}: {
  query: string;
  selectedId?: string;
  showLevel: boolean;
}) {
  const search = useCaseSearch(query);

  if (search.tooShort) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Saisissez au moins 2 caractères.
      </p>
    );
  }

  return (
    <div className="py-1" aria-busy={search.pending}>
      <p className="px-4 py-1.5 text-xs text-muted-foreground" role="status">
        {searchStatusLabel(search)}
      </p>
      <ul className={cn(search.pending && "opacity-60")}>
        {search.results.map((r) => {
          const suffix = STATUS_SUFFIXES[r.status];
          const isSelected = r.id === selectedId;
          return (
            <li key={r.id}>
              <Link
                href={`/cases/${r.id}`}
                aria-current={isSelected ? "page" : undefined}
                className={cn(
                  "mx-3 flex flex-col rounded-lg px-3 py-1.5 text-sm hover:bg-muted/60",
                  isSelected && "bg-accent font-medium text-accent-foreground",
                  r.status !== "active" && "text-muted-foreground",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="truncate">{displayName(r.firstName, r.lastName)}</span>
                  {suffix && <span className="shrink-0 text-xs">({suffix})</span>}
                  {showLevel && (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {labelOf(EDUCATION_LEVEL_LABELS, r.educationLevel)}
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-muted-foreground">{r.campaignName}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
