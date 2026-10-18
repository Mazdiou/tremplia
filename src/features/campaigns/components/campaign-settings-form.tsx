"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
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
import { StageListEditor } from "@/features/stages/components/stage-list-editor";
import { MAX_CAMPAIGN_DATES, MAX_CAMPAIGN_GROUPS, MAX_CAMPAIGN_INFOS } from "../schemas";
import { PlatformListInput } from "./platform-list-input";

type CampaignSettingsDraft = {
  name: string;
  dates: { label: string; date: string }[];
  infos: { label: string; value: string }[];
  suggestedPlatforms: string[];
  // Saisie du tarif par défaut (« 150 000 »), vide : aucun
  defaultFee: string;
};

const DATE_GRID = "sm:grid-cols-[1fr_11rem_2.5rem]";
const INFO_GRID = "sm:grid-cols-[1fr_2fr_2.5rem]";
// Téléphone : le libellé et la corbeille sur une ligne, l'autre champ dessous,
// un trait entre deux lignes de la liste
const PHONE_ROW =
  "max-sm:grid-cols-[minmax(0,1fr)_2.5rem] max-sm:border-b max-sm:pb-4 max-sm:last:border-b-0 max-sm:last:pb-0";
const PHONE_SECOND = "max-sm:col-start-1 max-sm:row-start-2";
const PHONE_REMOVE = "max-sm:col-start-2 max-sm:row-start-1";

// Création (avec les groupes de départ) ou modification des réglages d'une
// campagne. Réservé au patron ; la base le revérifie.
export function CampaignSettingsForm({
  campaignId,
  initial,
  initialStages = [],
}: {
  // Absent : création d'une nouvelle campagne
  campaignId?: string;
  initial: CampaignSettingsDraft;
  // Création : étapes proposées (valeurs par défaut de l'agence)
  initialStages?: string[];
}) {
  const router = useRouter();
  const isEdit = Boolean(campaignId);
  const [draft, setDraft] = useState(initial);
  const [groups, setGroups] = useState<string[]>([]);
  const [stages, setStages] = useState(initialStages);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const patch = (p: Partial<CampaignSettingsDraft>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...p }));
  };

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

        <PlatformListInput
          id="platform-new"
          value={draft.suggestedPlatforms}
          onChange={(suggestedPlatforms) => patch({ suggestedPlatforms })}
          error={errors.suggestedPlatforms}
        />
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
              <div key={i} className={`grid items-start gap-3 ${DATE_GRID} ${PHONE_ROW}`}>
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
                  className={PHONE_SECOND}
                  value={d.date}
                  onChange={(date) =>
                    patch({ dates: draft.dates.map((x, j) => (j === i ? { ...x, date } : x)) })
                  }
                  error={errors[`dates.${i}.date`]}
                />
                <div className={PHONE_REMOVE}>
                  <RemoveButton
                    label={`Retirer la date ${i + 1}`}
                    onClick={() => patch({ dates: draft.dates.filter((_, j) => j !== i) })}
                  />
                </div>
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
              <div key={i} className={`grid items-start gap-3 ${INFO_GRID} ${PHONE_ROW}`}>
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
                  className={PHONE_SECOND}
                  value={info.value}
                  onChange={(value) =>
                    patch({ infos: draft.infos.map((x, j) => (j === i ? { ...x, value } : x)) })
                  }
                  error={errors[`infos.${i}.value`]}
                />
                <div className={PHONE_REMOVE}>
                  <RemoveButton
                    label={`Retirer l'information ${i + 1}`}
                    onClick={() => patch({ infos: draft.infos.filter((_, j) => j !== i) })}
                  />
                </div>
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
          <StageListEditor idPrefix="stage" value={stages} onChange={setStages} errors={errors} />
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
          {saving ? "Enregistrement…" : isEdit ? "Enregistrer les réglages" : "Créer la campagne"}
        </Button>
      </FormActions>
    </form>
  );
}
