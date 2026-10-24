import { Panel } from "@/components/page-ui";
import { PROGRAM_RESULT_LABELS, type ProgramResult } from "@/features/programs/schemas";
import type { Results } from "../server/dashboard";
import { plural } from "@/lib/plural";

// Réponses des établissements : une barre répartie et la légende chiffrée.
// L'ordre suit le parcours, de la meilleure nouvelle à l'attente.
const ORDER: { result: ProgramResult; color: string }[] = [
  { result: "accepted", color: "bg-success" },
  { result: "waitlisted", color: "bg-amber-500" },
  { result: "rejected", color: "bg-destructive" },
  { result: "sent", color: "bg-primary" },
  { result: "none", color: "bg-muted-foreground/25" },
];

export function ResultsPanel({ results }: { results: Results }) {
  const { counts, total } = results;
  return (
    <Panel title="Réponses des établissements">
      {total === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">
          Aucune formation saisie pour le moment.
        </p>
      ) : (
        <div className="space-y-4 px-5 py-4">
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={ORDER.map(({ result }) => `${PROGRAM_RESULT_LABELS[result]} : ${counts[result]}`).join(", ")}
          >
            {ORDER.map(({ result, color }) =>
              counts[result] > 0 ? (
                <span
                  key={result}
                  className={color}
                  style={{ width: `${(counts[result] / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          {/* Pleine largeur : une case par réponse, côte à côte, au lieu
              d'une liste étirée d'un bord à l'autre */}
          <dl className="grid gap-y-1.5 text-sm @3xl:grid-cols-5 @3xl:gap-x-6">
            {ORDER.map(({ result, color }) => (
              <div
                key={result}
                className="flex items-center gap-2 @3xl:flex-col @3xl:items-start @3xl:gap-0.5"
              >
                <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <span className={`size-2.5 shrink-0 rounded-full ${color}`} aria-hidden />
                  <span className="truncate">{PROGRAM_RESULT_LABELS[result]}</span>
                </dt>
                <dd className="ml-auto font-medium tabular-nums @3xl:ml-0 @3xl:text-2xl @3xl:font-semibold @3xl:tracking-tight">
                  {counts[result]}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            {plural(total, "formation")} au total, dossiers abandonnés exclus.
          </p>
        </div>
      )}
    </Panel>
  );
}
