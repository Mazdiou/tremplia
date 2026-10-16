"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Trash2, X } from "lucide-react";
import { FormActions, FormSection } from "@/components/page-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AmountField,
  FieldError,
  ListHeader,
  RemoveButton,
  TextField,
} from "@/components/form-fields";
import { callApi } from "@/lib/api-client";
import {
  MAX_CAMPAIGN_DATES,
  MAX_CAMPAIGN_GROUPS,
  MAX_CAMPAIGN_INFOS,
  MAX_SUGGESTED_PLATFORMS,
} from "../schemas";
import { MAX_STAGES } from "@/features/stages/schemas";
import { DEFAULT_STAGES } from "@/features/stages/stages";

export type CampaignSettingsDraft = {
  name: string;
  dates: { label: string; date: string }[];
  infos: { label: string; value: string }[];
  suggestedPlatforms: string[];
  // Saisie du tarif par défaut (« 150 000 »), vide : aucun
  defaultFee: string;
};

const DATE_GRID = "sm:grid-cols-[1fr_11rem_2.5rem]";
const INFO_GRID = "sm:grid-cols-[1fr_2fr_2.5rem]";

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
  const [stages, setStages] = useState<string[]>([...DEFAULT_STAGES]);
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
    const res = await callApi<{ id: string }>(
      isEdit ? `/api/campaigns/${campaignId}` : "/api/campaigns",
      { method: isEdit ? "PATCH" : "POST", body: isEdit ? draft : { ...draft, groups, stages } },
    );
    setSaving(false);
    if (!res.ok) {
      setErrors(res.fieldErrors);
      setError(res.error);
      return;
    }
    if (isEdit) {
      setSaved(true);
      router.refresh();
    } else {
      router.push(`/campaigns/${res.data.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <FormSection
        title="Général"
        description="Le nom de la campagne, son tarif et les plateformes proposées pour les comptes des candidats."
      >
        <TextField
          id="campaign-name"
          label="Nom de la campagne"
          required
          maxLength={100}
          placeholder="Ex. : Campus France 2026/2027"
          value={draft.name}
          onChange={(name) => patch({ name })}
          error={errors.name}
        />

        <AmountField
          id="campaign-default-fee"
          label="Tarif par défaut"
          value={draft.defaultFee}
          onChange={(defaultFee) => patch({ defaultFee })}
          hint="Proposé comme montant convenu à la création d'un dossier. Facultatif."
          error={errors.defaultFee}
          className="max-w-xs"
        />

        <div className="space-y-2">
          <Label htmlFor="platform-new">Plateformes suggérées</Label>
          {draft.suggestedPlatforms.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {draft.suggestedPlatforms.map((p) => (
                <li
                  key={p}
                  className="flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-3 text-sm"
                >
                  {p}
                  <button
                    type="button"
                    aria-label={`Retirer ${p}`}
                    className="grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() =>
                      patch({
                        suggestedPlatforms: draft.suggestedPlatforms.filter((x) => x !== p),
                      })
                    }
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {draft.suggestedPlatforms.length < MAX_SUGGESTED_PLATFORMS && (
            <div className="flex max-w-sm gap-2">
              <Input
                id="platform-new"
                placeholder="Ex. : Pastel, Parcoursup"
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
              <Button type="button" variant="outline" onClick={addPlatform}>
                Ajouter
              </Button>
            </div>
          )}
          <FieldError message={errors.suggestedPlatforms} />
        </div>
      </FormSection>

      <FormSection
        title="Dates"
        description="Échéances de la campagne : la plus proche s'affiche sur le tableau de bord."
      >
        {draft.dates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune date pour le moment.</p>
        ) : (
          <div className="space-y-3">
            <ListHeader columns={["Libellé", "Date", ""]} className={DATE_GRID} />
            {draft.dates.map((d, i) => (
              <div key={i} className={`grid items-start gap-3 ${DATE_GRID}`}>
                <TextField
                  id={`date-${i}-label`}
                  label="Libellé"
                  hideLabel
                  required
                  maxLength={100}
                  placeholder="Ex. : Date limite DAP"
                  value={d.label}
                  onChange={(label) =>
                    patch({ dates: draft.dates.map((x, j) => (j === i ? { ...x, label } : x)) })
                  }
                  error={errors[`dates.${i}.label`]}
                />
                <TextField
                  id={`date-${i}-date`}
                  label="Date"
                  hideLabel
                  type="date"
                  required
                  value={d.date}
                  onChange={(date) =>
                    patch({ dates: draft.dates.map((x, j) => (j === i ? { ...x, date } : x)) })
                  }
                  error={errors[`dates.${i}.date`]}
                />
                <RemoveButton
                  label={`Retirer la date ${i + 1}`}
                  onClick={() => patch({ dates: draft.dates.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
          </div>
        )}
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
      </FormSection>

      <FormSection
        title="Informations"
        description="Ce qu'il faut savoir sur la campagne : pays, consulat, frais…"
      >
        {draft.infos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune information pour le moment.</p>
        ) : (
          <div className="space-y-3">
            <ListHeader columns={["Libellé", "Valeur", ""]} className={INFO_GRID} />
            {draft.infos.map((info, i) => (
              <div key={i} className={`grid items-start gap-3 ${INFO_GRID}`}>
                <TextField
                  id={`info-${i}-label`}
                  label="Libellé"
                  hideLabel
                  required
                  maxLength={100}
                  placeholder="Ex. : Pays"
                  value={info.label}
                  onChange={(label) =>
                    patch({ infos: draft.infos.map((x, j) => (j === i ? { ...x, label } : x)) })
                  }
                  error={errors[`infos.${i}.label`]}
                />
                <TextField
                  id={`info-${i}-value`}
                  label="Valeur"
                  hideLabel
                  required
                  maxLength={500}
                  placeholder="Ex. : France"
                  value={info.value}
                  onChange={(value) =>
                    patch({ infos: draft.infos.map((x, j) => (j === i ? { ...x, value } : x)) })
                  }
                  error={errors[`infos.${i}.value`]}
                />
                <RemoveButton
                  label={`Retirer l'information ${i + 1}`}
                  onClick={() => patch({ infos: draft.infos.filter((_, j) => j !== i) })}
                />
              </div>
            ))}
          </div>
        )}
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
      </FormSection>

      {!isEdit && (
        <FormSection
          title="Groupes de départ"
          description="Pour ranger les dossiers (DAP, Hors-DAP, École…). Modifiables ensuite."
        >
          {groups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sans groupe, tous les dossiers sont « Non classés ».
            </p>
          )}
          {groups.map((g, i) => (
            <div key={i} className="flex max-w-md items-start gap-2">
              <Label htmlFor={`group-${i}`} className="sr-only">
                Groupe {i + 1}
              </Label>
              <Input
                id={`group-${i}`}
                value={g}
                maxLength={80}
                placeholder="Nom du groupe"
                onChange={(e) => setGroups(groups.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Retirer le groupe ${i + 1}`}
                className="text-muted-foreground hover:text-destructive"
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
        </FormSection>
      )}

      {!isEdit && (
        <FormSection
          title="Étapes des dossiers"
          description="Le parcours d'un dossier, dans l'ordre : chaque nouveau dossier commence à la première. Modifiables ensuite."
        >
          {stages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Sans étape, les dossiers n&apos;affichent pas leur avancement.
            </p>
          )}
          <ol className="space-y-2">
            {stages.map((s, i) => (
              <li key={i} className="flex max-w-md items-start gap-2">
                <span
                  aria-hidden
                  className="mt-2 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums"
                >
                  {i + 1}
                </span>
                <Label htmlFor={`stage-${i}`} className="sr-only">
                  Étape {i + 1}
                </Label>
                <Input
                  id={`stage-${i}`}
                  value={s}
                  maxLength={60}
                  placeholder="Nom de l'étape"
                  onChange={(e) => setStages(stages.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Retirer l'étape ${i + 1}`}
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setStages(stages.filter((_, j) => j !== i))}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
          {stages.length < MAX_STAGES && (
            <Button type="button" variant="outline" size="sm" onClick={() => setStages([...stages, ""])}>
              <Plus /> Ajouter une étape
            </Button>
          )}
          <FieldError message={errors.stages ?? Object.entries(errors).find(([k]) => k.startsWith("stages."))?.[1]} />
        </FormSection>
      )}

      <FormActions>
        {error && (
          <p className="mr-auto text-sm font-medium text-destructive" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="mr-auto flex items-center gap-1.5 text-sm text-success" role="status">
            <CheckCircle2 className="size-4" aria-hidden /> Modifications enregistrées
          </p>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Enregistrement..." : isEdit ? "Enregistrer les réglages" : "Créer la campagne"}
        </Button>
      </FormActions>
    </form>
  );
}
