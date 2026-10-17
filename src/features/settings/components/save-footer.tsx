"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";

// Enregistrement d'un formulaire de la page Réglages : chaque section a le
// sien, avec son bouton et ses messages.
export function useSettingsSave(url: string, method = "PATCH") {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function save(body: unknown): Promise<boolean> {
    setError(null);
    setErrors({});
    setSaved(false);
    setSaving(true);
    const res = await callApi(url, { method, body });
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors);
      // Erreur déjà affichée sous son champ : pas de doublon près du bouton
      if (Object.keys(res.fieldErrors).length === 0) setError(res.error);
      return false;
    }
    setSaved(true);
    router.refresh();
    return true;
  }

  // Une saisie après l'enregistrement efface « Modifications enregistrées »
  const touch = () => setSaved(false);

  return { save, touch, saving, saved, error, errors };
}

export function SaveFooter({
  saving,
  saved,
  error,
  label = "Enregistrer",
  savedLabel = "Modifications enregistrées",
}: {
  saving: boolean;
  saved: boolean;
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
      <Button type="submit" disabled={saving}>
        {saving ? "Enregistrement…" : label}
      </Button>
    </div>
  );
}
