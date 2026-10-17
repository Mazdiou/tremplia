"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";

// Enregistrement d'un formulaire de la page Réglages : chaque section a le
// sien, avec son bouton et ses messages. Le bouton ne s'active qu'une fois
// la saisie différente de la dernière version enregistrée.
export function useSettingsSave<T>(url: string, draft: T, initial: T) {
  const router = useRouter();
  const [baseline, setBaseline] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  async function save(): Promise<boolean> {
    setError(null);
    setErrors({});
    setSaved(false);
    setSaving(true);
    const sent = draft;
    const res = await callApi(url, { method: "PATCH", body: sent });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors);
      // Erreur déjà affichée sous son champ : pas de doublon près du bouton
      if (Object.keys(res.fieldErrors).length === 0) setError(res.error);
      return false;
    }
    setBaseline(sent);
    setSaved(true);
    router.refresh();
    return true;
  }

  // « Modifications enregistrées » s'efface dès la saisie suivante
  return { save, dirty, saving, saved: saved && !dirty, error, errors };
}

export function SaveFooter({
  saving,
  saved,
  dirty,
  error,
  label = "Enregistrer",
  savedLabel = "Modifications enregistrées",
}: {
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  error: string | null;
  label?: string;
  savedLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t pt-4">
      {error && (
        <p className="mr-auto text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="mr-auto flex items-center gap-1.5 text-sm text-success" role="status">
          <CheckCircle2 className="size-4" aria-hidden /> {savedLabel}
        </p>
      )}
      <Button type="submit" disabled={saving || !dirty}>
        {saving ? "Enregistrement…" : label}
      </Button>
    </div>
  );
}
