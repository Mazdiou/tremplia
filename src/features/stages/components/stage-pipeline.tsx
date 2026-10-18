import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Panel } from "@/components/page-ui";

// Avancement des dossiers actifs d'une campagne, étape par étape (tableau de
// bord). Chaque étape mène à l'arbre des dossiers filtré sur elle.
export function StagePipeline({
  campaignId,
  stages,
}: {
  campaignId: string;
  stages: { id: string; name: string; activeCases: number }[];
}) {
  if (stages.length === 0) return null;
  const max = Math.max(1, ...stages.map((s) => s.activeCases));
  return (
    <Panel
      title="Avancement des dossiers"
      description="Dossiers actifs à chaque étape."
      actions={
        <Link
          href={`/campaigns/${campaignId}`}
          className="touch-target text-xs text-muted-foreground hover:text-foreground"
        >
          Voir la campagne
        </Link>
      }
    >
      {/* Téléphone : une ligne par étape (nom, barre, nombre), bien moins
          haut qu'une grille de cases */}
      <ol className="divide-y sm:hidden">
        {stages.map((s, i) => (
          <li key={s.id}>
            <Link
              href={`/cases?campagne=${campaignId}&etape=${s.id}`}
              className="flex min-h-11 items-center gap-3 px-5 py-2 text-sm active:bg-muted/60"
            >
              <span
                aria-hidden
                className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">{s.name}</span>
              <span aria-hidden className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(s.activeCases / max) * 100}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right font-semibold tabular-nums">
                <span className="sr-only">Dossiers actifs : </span>
                {s.activeCases}
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {/* Bordures à droite et en bas de chaque case ; celles du bord sont
          masquées par le panneau (marges négatives) */}
      <ol className="-mr-px -mb-px grid grid-cols-2 max-sm:hidden sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        {stages.map((s, i) => (
          <li key={s.id} className="border-r border-b">
            <Link
              href={`/cases?campagne=${campaignId}&etape=${s.id}`}
              className="group flex h-full flex-col px-4 py-3 transition-colors hover:bg-muted/60"
            >
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="tabular-nums">Étape {i + 1}</span>
                {i < stages.length - 1 && (
                  <ChevronRight className="size-3 max-sm:hidden" aria-hidden />
                )}
              </span>
              <span className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums group-hover:text-link">
                {s.activeCases}
              </span>
              <span className="line-clamp-2 text-sm">{s.name}</span>
            </Link>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
