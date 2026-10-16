"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { stageProgress } from "../stages";

type Stage = { id: string; name: string };

// Étape du dossier dans l'en-tête de sa fiche : barre d'avancement, choix de
// l'étape et passage à la suivante (tout membre actif). Rien si la campagne
// n'a pas d'étape.
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
    <section aria-label="Étape du dossier" className="mt-3 rounded-xl border bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <ol aria-hidden className="flex w-24 shrink-0 gap-0.5 sm:w-36">
            {stages.map((s, i) => (
              <li
                key={s.id}
                title={s.name}
                className={cn(
                  "h-1.5 flex-1 rounded-full",
                  progress && i <= progress.index ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </ol>
          <p className="min-w-0 truncate text-sm">
            {progress ? (
              <>
                <span className="text-muted-foreground tabular-nums">
                  Étape {progress.index + 1} sur {progress.total} ·{" "}
                </span>
                <span className="font-medium">{progress.stage.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Aucune étape choisie</span>
            )}
          </p>
        </div>

        {!readOnly && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <label className="sr-only" htmlFor={`stage-${caseId}`}>
              Changer l&apos;étape du dossier
            </label>
            <select
              id={`stage-${caseId}`}
              value={current ?? ""}
              disabled={busy}
              onChange={(e) => void change(e.target.value)}
              className="h-8 min-w-0 flex-1 rounded-lg border sm:max-w-52 sm:flex-none bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {!progress && (
                <option value="" disabled>
                  Choisir une étape
                </option>
              )}
              {stages.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i + 1}. {s.name}
                </option>
              ))}
            </select>
            {(progress?.next ?? (!progress ? stages[0] : null)) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void change((progress?.next ?? stages[0]).id)}
                title={`Passer à « ${(progress?.next ?? stages[0]).name} »`}
                className="shrink-0"
              >
                {progress ? "Étape suivante" : "Commencer"} <ArrowRight />
              </Button>
            )}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
