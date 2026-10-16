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
  return (
    <Panel
      title="Avancement des dossiers"
      description="Dossiers actifs à chaque étape."
      actions={
        <Link
          href={`/campaigns/${campaignId}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Voir la campagne
        </Link>
      }
    >
      {/* Bordures à droite et en bas de chaque case ; celles du bord sont
          masquées par le panneau (marges négatives) */}
      <ol className="-mr-px -mb-px grid grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
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
              <span className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums group-hover:text-primary">
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
