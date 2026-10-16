"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { EDUCATION_LEVEL_LABELS, STATUS_SUFFIXES, labelOf } from "@/features/cases/labels";
import { CASE_SEARCH_LIMIT } from "@/features/cases/schemas";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/plural";
import type { CaseSearchResult } from "@/features/cases/server/lookups";

const DEBOUNCE_MS = 300;

// Recherche globale dans toute l'agence, toutes campagnes confondues (y
// compris archivées). La saisie part en POST : jamais de nom dans une adresse.
export function TreeSearchResults({
  query,
  selectedId,
  showLevel,
}: {
  query: string;
  selectedId?: string;
  showLevel: boolean;
}) {
  const trimmed = query.trim();
  const [results, setResults] = useState<CaseSearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchedFor, setSearchedFor] = useState("");

  useEffect(() => {
    if (trimmed.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/cases/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data?.results)) {
          setError(data?.error ?? "Recherche impossible");
          setResults(null);
        } else {
          setError(null);
          setResults(data.results as CaseSearchResult[]);
        }
        setSearchedFor(trimmed);
      } catch {
        // Recherche remplacée par une plus récente : rien à faire
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  if (trimmed.length < 2) {
    return (
      <p className="px-4 py-3 text-sm text-muted-foreground">
        Saisissez au moins 2 caractères.
      </p>
    );
  }

  const pending = searchedFor !== trimmed;

  return (
    <div className="py-1" aria-busy={pending}>
      <p className="px-4 py-1.5 text-xs text-muted-foreground" role="status">
        {pending
          ? "Recherche…"
          : error
            ? error
            : results && results.length === 0
              ? "Aucun dossier ne correspond."
              : `${plural(results?.length ?? 0, "résultat")}${results?.length === CASE_SEARCH_LIMIT ? ` (les ${CASE_SEARCH_LIMIT} premiers)` : ""}`}
      </p>
      <ul className={cn(pending && "opacity-60")}>
        {(results ?? []).map((r) => {
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
