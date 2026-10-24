"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { formatLongDate } from "@/lib/dates";
import type { CampaignTemplate } from "@/config/campaign-templates";

// Galerie des modèles préconfigurés. L'import crée une copie modifiable ;
// un modèle déjà importé par l'agence est désactivé.
export function TemplateGallery({
  templates,
  importedKeys,
}: {
  templates: readonly CampaignTemplate[];
  importedKeys: string[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importTemplate(key: string) {
    setError(null);
    setPending(key);
    const res = await callApi<{ id: string }>("/api/campaigns/import", {
      body: { templateKey: key },
    });
    if (!res.ok) {
      setPending(null);
      setError(res.error);
      return;
    }
    // Import en cours affiché jusqu'à l'arrivée sur la campagne créée
    router.push(`/campaigns/${res.data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => {
          const imported = importedKeys.includes(t.key);
          return (
            <li key={t.key} className="flex flex-col rounded-2xl border bg-card">
              <div className="space-y-1 p-5 pb-4">
                <h3 className="font-semibold">{t.name}</h3>
                {t.description && (
                  <p className="text-sm text-muted-foreground">{t.description}</p>
                )}
                {t.groups.length > 0 && (
                  <ul className="flex flex-wrap gap-1.5 pt-2" aria-label="Groupes">
                    {t.groups.map((g) => (
                      <li key={g} className="rounded-full border px-2 py-0.5 text-xs">
                        {g}
                      </li>
                    ))}
                  </ul>
                )}
                {t.stages.length > 0 && (
                  <p className="pt-2 text-xs text-muted-foreground">
                    {t.stages.length} étapes : {t.stages.join(" → ")}
                  </p>
                )}
              </div>
              {t.dates.length > 0 && (
                <ul className="mx-5 space-y-1.5 border-t py-3 text-sm">
                  {t.dates.map((d) => (
                    <li key={`${d.label}-${d.date}`} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="shrink-0 tabular-nums">{formatLongDate(d.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto border-t p-4">
                <Button
                  className="w-full"
                  variant={imported ? "outline" : "default"}
                  disabled={imported || pending !== null}
                  onClick={() => importTemplate(t.key)}
                >
                  {imported ? (
                    <>
                      <Check /> Déjà importé
                    </>
                  ) : (
                    <>
                      <Download /> {pending === t.key ? "Import…" : "Importer ce modèle"}
                    </>
                  )}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
