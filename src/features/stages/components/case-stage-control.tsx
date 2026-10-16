"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Milestone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TRACK_INDENT, TrackRow } from "@/features/cases/components/case-header";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { stageProgress } from "../stages";

type Stage = { id: string; name: string };

// Étape du dossier, première ligne du panneau de suivi de sa fiche : barre
// d'avancement, nom de l'étape (qui sert aussi à en choisir une autre) et
// passage à la suivante (tout membre actif). Rien si la campagne n'a pas
// d'étape.
export function CaseStageControl({
  caseId,
  stages,
  stageId,
  readOnly,
}: {
  caseId: string;
  // Étapes de la campagne, dans l'ordre
  stages: Stage[];
  stageId: string | null;
  // Abonnement expiré : affichage seulement
  readOnly: boolean;
}) {
  const router = useRouter();
  // Choix affiché tout de suite, annulé si l'enregistrement échoue
  const [optimistic, setOptimistic] = useState<{ from: string | null; to: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (stages.length === 0) return null;

  // Après la relecture du serveur, le choix local n'a plus d'effet
  const current = optimistic && optimistic.from === stageId ? optimistic.to : stageId;
  const progress = stageProgress(stages, current);
  const busy = optimistic !== null && optimistic.from === stageId;
  const next = progress ? progress.next : stages[0];

  async function change(to: string) {
    if (to === current) return;
    setError(null);
    setOptimistic({ from: stageId, to });
    const res = await callApi(`/api/cases/${caseId}/stage`, {
      method: "PATCH",
      body: { stageId: to },
    });
    if (!res.ok) {
      setOptimistic(null);
      setError(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <TrackRow
        icon={Milestone}
        label="Étape"
        actions={
          !readOnly &&
          next && (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              disabled={busy}
              onClick={() => void change(next.id)}
              title={`Passer à « ${next.name} »`}
            >
              {progress ? "Étape suivante" : "Commencer"} <ArrowRight />
            </Button>
          )
        }
      >
        <ol aria-hidden className="flex w-20 shrink-0 gap-0.5">
          {stages.map((s, i) => (
            <li
              key={s.id}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                progress && i <= progress.index ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </ol>
        {progress && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {progress.index + 1}/{progress.total}
          </span>
        )}
        {readOnly ? (
          <span className="min-w-0 truncate font-medium">
            {progress?.stage.name ?? "Aucune étape"}
          </span>
        ) : (
          // Le nom de l'étape est la liste elle-même : un clic pour en changer
          <span className="relative min-w-0 max-w-full">
            <label className="sr-only" htmlFor={`stage-${caseId}`}>
              Étape du dossier
            </label>
            <select
              id={`stage-${caseId}`}
              value={current ?? ""}
              disabled={busy}
              onChange={(e) => void change(e.target.value)}
              className="h-7 max-w-full cursor-pointer appearance-none truncate rounded-md border border-transparent bg-transparent pr-6 pl-1.5 font-medium outline-none hover:border-border hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
            >
              {!progress && (
                <option value="" disabled>
                  Choisir une étape
                </option>
              )}
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-1.5 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
          </span>
        )}
      </TrackRow>
      {error && (
        <p className={cn("pb-2 text-sm text-destructive", TRACK_INDENT)} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
