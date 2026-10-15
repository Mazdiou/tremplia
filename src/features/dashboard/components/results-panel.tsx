import { Panel } from "@/components/page-ui";
import { PROGRAM_RESULT_LABELS, type ProgramResult } from "@/features/programs/schemas";
import type { Results } from "../server/dashboard";

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
  const { counts, total, admitted } = results;
  return (
    <Panel title="Réponses des établissements">
      {total === 0 ? (
        <p className="px-5 py-5 text-sm text-muted-foreground">
          Aucune formation saisie pour le moment.
        </p>
      ) : (
        <div className="space-y-4 px-5 py-4">
          <p>
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{admitted}</span>{" "}
            <span className="text-sm text-muted-foreground">
              candidat{admitted > 1 ? "s" : ""} admis dans au moins une formation
            </span>
          </p>
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
          <dl className="grid gap-y-1.5 text-sm">
            {ORDER.map(({ result, color }) => (
              <div key={result} className="flex items-center gap-2">
                <span className={`size-2.5 shrink-0 rounded-full ${color}`} aria-hidden />
                <dt className="min-w-0 truncate text-muted-foreground">
                  {PROGRAM_RESULT_LABELS[result]}
                </dt>
                <dd className="ml-auto font-medium tabular-nums">{counts[result]}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            {total} formation{total > 1 ? "s" : ""} au total, dossiers abandonnés exclus.
          </p>
        </div>
      )}
    </Panel>
  );
}
