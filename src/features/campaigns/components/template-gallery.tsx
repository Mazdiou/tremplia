"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
    const res = await fetch("/api/campaigns/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateKey: key }),
    });
    const data = await res.json().catch(() => null);
    setPending(null);
    if (!res.ok) {
      setError(data?.error ?? `Erreur ${res.status}`);
      return;
    }
    router.push(`/campaigns/${data.id}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {templates.map((t) => {
          const imported = importedKeys.includes(t.key);
          return (
            <li key={t.key} className="flex flex-col rounded-2xl border bg-card p-5">
              <h3 className="font-semibold">{t.name}</h3>
              {t.description && (
                <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              )}
              {t.groups.length > 0 && (
                <p className="mt-3 text-sm">
                  <span className="text-muted-foreground">Groupes : </span>
                  {t.groups.join(", ")}
                </p>
              )}
              {t.dates.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {t.dates.map((d) => (
                    <li key={`${d.label}-${d.date}`} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className="shrink-0">{formatLongDate(d.date)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 pt-1">
                <Button
                  size="sm"
                  disabled={imported || pending !== null}
                  onClick={() => importTemplate(t.key)}
                >
                  {imported
                    ? "Déjà importé"
                    : pending === t.key
                      ? "Import..."
                      : "Importer ce modèle"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
