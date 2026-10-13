"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, TextField } from "@/features/cases/components/form-fields";
import {
  MAX_CAMPAIGN_DATES,
  MAX_CAMPAIGN_GROUPS,
  MAX_CAMPAIGN_INFOS,
  MAX_SUGGESTED_PLATFORMS,
} from "../schemas";

export type CampaignSettingsDraft = {
  name: string;
  dates: { label: string; date: string }[];
  infos: { label: string; value: string }[];
  suggestedPlatforms: string[];
};

// Création (avec les groupes de départ) ou modification des réglages d'une
// campagne. Réservé au patron ; la base le revérifie.
export function CampaignSettingsForm({
  campaignId,
  initial,
}: {
  // Absent : création d'une nouvelle campagne
  campaignId?: string;
  initial: CampaignSettingsDraft;
}) {
  const router = useRouter();
  const isEdit = Boolean(campaignId);
  const [draft, setDraft] = useState(initial);
  const [groups, setGroups] = useState<string[]>([]);
  const [platformInput, setPlatformInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const patch = (p: Partial<CampaignSettingsDraft>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...p }));
  };

  function addPlatform() {
    const value = platformInput.trim();
    if (!value) return;
    const exists = draft.suggestedPlatforms.some(
      (p) => p.toLocaleLowerCase("fr") === value.toLocaleLowerCase("fr"),
    );
    if (!exists) patch({ suggestedPlatforms: [...draft.suggestedPlatforms, value] });
    setPlatformInput("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setErrors({});
    setSaving(true);
    const res = await fetch(isEdit ? `/api/campaigns/${campaignId}` : "/api/campaigns", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? draft : { ...draft, groups }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      if (Array.isArray(data?.fields)) {
        const map: Record<string, string> = {};
        for (const f of data.fields as { path: string; message: string }[]) {
          map[f.path] ??= f.message;
        }
        setErrors(map);
      }
      setError(data?.error ?? `Erreur ${res.status}`);
      return;
    }
    if (isEdit) {
      setSaved(true);
      router.refresh();
    } else {
      router.push(`/campaigns/${data.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <TextField
        id="campaign-name"
        label="Nom de la campagne"
        required
        maxLength={100}
        value={draft.name}
        onChange={(name) => patch({ name })}
        error={errors.name}
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Dates</legend>
        {draft.dates.map((d, i) => (
          <div key={i} className="grid items-start gap-3 sm:grid-cols-[1fr_10rem_auto]">
            <TextField
              id={`date-${i}-label`}
              label="Libellé"
              required
              maxLength={100}
              value={d.label}
              onChange={(label) =>
                patch({ dates: draft.dates.map((x, j) => (j === i ? { ...x, label } : x)) })
              }
              error={errors[`dates.${i}.label`]}
            />
            <TextField
              id={`date-${i}-date`}
              label="Date"
              type="date"
              required
              value={d.date}
              onChange={(date) =>
                patch({ dates: draft.dates.map((x, j) => (j === i ? { ...x, date } : x)) })
              }
              error={errors[`dates.${i}.date`]}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-6"
              aria-label={`Retirer la date ${i + 1}`}
              onClick={() => patch({ dates: draft.dates.filter((_, j) => j !== i) })}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {draft.dates.length < MAX_CAMPAIGN_DATES && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => patch({ dates: [...draft.dates, { label: "", date: "" }] })}
          >
            <Plus /> Ajouter une date
          </Button>
        )}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Informations</legend>
        {draft.infos.map((info, i) => (
          <div key={i} className="grid items-start gap-3 sm:grid-cols-[1fr_2fr_auto]">
            <TextField
              id={`info-${i}-label`}
              label="Libellé"
              required
              maxLength={100}
              value={info.label}
              onChange={(label) =>
                patch({ infos: draft.infos.map((x, j) => (j === i ? { ...x, label } : x)) })
              }
              error={errors[`infos.${i}.label`]}
            />
            <TextField
              id={`info-${i}-value`}
              label="Valeur"
              required
              maxLength={500}
              value={info.value}
              onChange={(value) =>
                patch({ infos: draft.infos.map((x, j) => (j === i ? { ...x, value } : x)) })
              }
              error={errors[`infos.${i}.value`]}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="mt-6"
              aria-label={`Retirer l'information ${i + 1}`}
              onClick={() => patch({ infos: draft.infos.filter((_, j) => j !== i) })}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        {draft.infos.length < MAX_CAMPAIGN_INFOS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => patch({ infos: [...draft.infos, { label: "", value: "" }] })}
          >
            <Plus /> Ajouter une information
          </Button>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Plateformes suggérées</legend>
        <p className="text-xs text-muted-foreground">
          Proposées lors de l&apos;ajout d&apos;un compte externe à un dossier.
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {draft.suggestedPlatforms.map((p) => (
            <li key={p} className="flex items-center gap-1 rounded-full border bg-card py-0.5 pr-1 pl-2.5 text-sm">
              {p}
              <button
                type="button"
                aria-label={`Retirer ${p}`}
                className="grid size-5 place-items-center rounded-full hover:bg-muted"
                onClick={() =>
                  patch({ suggestedPlatforms: draft.suggestedPlatforms.filter((x) => x !== p) })
                }
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        {draft.suggestedPlatforms.length < MAX_SUGGESTED_PLATFORMS && (
          <div className="flex max-w-sm gap-2">
            <Label htmlFor="platform-new" className="sr-only">
              Nouvelle plateforme
            </Label>
            <Input
              id="platform-new"
              placeholder="Pastel, Parcoursup…"
              value={platformInput}
              maxLength={80}
              onChange={(e) => setPlatformInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPlatform();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addPlatform}>
              Ajouter
            </Button>
          </div>
        )}
        <FieldError message={errors.suggestedPlatforms} />
      </fieldset>

      {!isEdit && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Groupes de départ</legend>
          <p className="text-xs text-muted-foreground">
            Pour ranger les dossiers (DAP, Hors-DAP, École…). Vous pourrez en
            ajouter, en renommer et en supprimer ensuite.
          </p>
          {groups.map((g, i) => (
            <div key={i} className="flex max-w-sm items-start gap-2">
              <Label htmlFor={`group-${i}`} className="sr-only">
                Groupe {i + 1}
              </Label>
              <Input
                id={`group-${i}`}
                value={g}
                maxLength={80}
                onChange={(e) => setGroups(groups.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer le groupe ${i + 1}`}
                onClick={() => setGroups(groups.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {groups.length < MAX_CAMPAIGN_GROUPS && (
            <Button type="button" variant="outline" size="sm" onClick={() => setGroups([...groups, ""])}>
              <Plus /> Ajouter un groupe
            </Button>
          )}
          <FieldError message={errors.groups} />
        </fieldset>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-success" role="status">
          Modifications enregistrées.
        </p>
      )}
      <Button type="submit" disabled={saving}>
        {saving ? "Enregistrement..." : isEdit ? "Enregistrer" : "Créer la campagne"}
      </Button>
    </form>
  );
}
