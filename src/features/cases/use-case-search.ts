"use client";

import { useEffect, useState } from "react";
import { CASE_SEARCH_LIMIT } from "@/features/cases/schemas";
import type { CaseSearchResult } from "@/features/cases/server/lookups";
import { plural } from "@/lib/plural";

const DEBOUNCE_MS = 300;

// Recherche globale dans toute l'agence, toutes campagnes confondues (y
// compris archivées), par nom ou téléphone. La saisie part en POST : jamais
// de nom dans une adresse. Rien n'est cherché sous 2 caractères.
export function useCaseSearch(query: string) {
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

  const tooShort = trimmed.length < 2;
  return {
    tooShort,
    pending: !tooShort && searchedFor !== trimmed,
    error: tooShort ? null : error,
    results: tooShort ? [] : (results ?? []),
  };
}

// Ligne d'état sous la saisie : en cours, erreur, aucun résultat ou nombre
export function searchStatusLabel({
  pending,
  error,
  results,
}: Pick<ReturnType<typeof useCaseSearch>, "pending" | "error" | "results">) {
  if (pending) return "Recherche…";
  if (error) return error;
  if (results.length === 0) return "Aucun dossier ne correspond.";
  return `${plural(results.length, "résultat")}${
    results.length === CASE_SEARCH_LIMIT ? ` (les ${CASE_SEARCH_LIMIT} premiers)` : ""
  }`;
}
