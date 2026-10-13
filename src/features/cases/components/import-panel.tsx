"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CaseFieldsDraft } from "@/features/cases/case-record";
import {
  EDUCATION_LEVEL_LABELS,
  STATUS_LABELS,
  labelOf,
} from "@/features/cases/labels";
import { displayName } from "@/lib/names";
import { SelectField, TextField } from "./form-fields";

export type SourceCampaign = { id: string; name: string; caseCount: number };

export type ImportMatch = {
  id: string;
  status: string;
  fields: CaseFieldsDraft;
  externalAccounts: {
    platform: string;
    url: string;
    login: string;
    status: "existing" | "to_create";
  }[];
};

// Import depuis une autre campagne : choisir la campagne source, puis
// retrouver le candidat par nom, prénom et date de naissance (en POST).
export function ImportPanel({
  sources,
  onImport,
}: {
  sources: SourceCampaign[];
  onImport: (match: ImportMatch, source: SourceCampaign) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ImportMatch[] | null>(null);
  const source = sources.find((s) => s.id === sourceId) ?? null;

  if (sources.length === 0) return null;

  async function search() {
    setError(null);
    setMatches(null);
    setLoading(true);
    const res = await fetch("/api/cases/import-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceCampaignId: sourceId, lastName, firstName, birthDate }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !Array.isArray(data?.matches)) {
      setError(data?.error ?? `Erreur ${res.status}`);
      return;
    }
    setMatches(data.matches as ImportMatch[]);
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Importer depuis une autre campagne
      </Button>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-base font-semibold">Importer depuis une autre campagne</h2>
      <p className="text-sm text-muted-foreground">
        Reprenez l&apos;identité, le parcours, les projets et les comptes
        externes d&apos;un candidat. Le nouveau dossier est indépendant :
        l&apos;ancien n&apos;est pas modifié, et ni ses groupes, ni ses notes,
        ni ses documents ne sont repris.
      </p>
      <SelectField
        id="import-source"
        label="Campagne d'origine"
        required
        value={sourceId}
        onChange={(v) => {
          setSourceId(v);
          setMatches(null);
        }}
        placeholder="Choisir une campagne..."
        options={sources.map((s) => ({
          value: s.id,
          label: `${s.name} (${s.caseCount} dossier${s.caseCount > 1 ? "s" : ""})`,
        }))}
      />
      {source && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField id="import-last" label="Nom" value={lastName} onChange={setLastName} />
            <TextField id="import-first" label="Prénom" value={firstName} onChange={setFirstName} />
            <TextField
              id="import-birth"
              label="Date de naissance"
              type="date"
              value={birthDate}
              onChange={setBirthDate}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={search}
              disabled={loading || !lastName.trim() || !firstName.trim() || !birthDate}
            >
              {loading ? "Recherche..." : "Rechercher"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Fermer
            </Button>
          </div>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {matches && matches.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          Aucun dossier trouvé pour ce nom, ce prénom et cette date de naissance
          dans cette campagne.
        </p>
      )}

      {source && matches && matches.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {matches.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
            >
              <span>
                {displayName(m.fields.firstName, m.fields.lastName)} ·{" "}
                {labelOf(EDUCATION_LEVEL_LABELS, m.fields.educationLevel)} ·{" "}
                {labelOf(STATUS_LABELS, m.status)}
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onImport(m, source);
                  setOpen(false);
                  setMatches(null);
                }}
              >
                Importer
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
