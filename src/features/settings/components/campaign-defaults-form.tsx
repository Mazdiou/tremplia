"use client";

import { useState } from "react";
import { AmountField } from "@/components/form-fields";
import { PlatformListInput } from "@/features/campaigns/components/platform-list-input";
import { StageListEditor } from "@/features/stages/components/stage-list-editor";
import { SaveFooter, useSettingsSave } from "./save-footer";

type Draft = {
  // Saisie du tarif (« 150 000 »), vide : aucun
  defaultFee: string;
  platforms: string[];
  stages: string[];
};

// Valeurs proposées à chaque nouvelle campagne. Une campagne déjà créée
// garde les siennes.
export function CampaignDefaultsForm({
  initial,
  readOnly,
}: {
  initial: Draft;
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  // Plateforme tapée mais pas encore ajoutée : elle le sera en quittant le
  // champ, le bouton doit donc déjà répondre au clic
  const [pendingPlatform, setPendingPlatform] = useState(false);
  const { save, dirty, saving, saved, error, errors } = useSettingsSave(
    "/api/settings/defaults",
    draft,
    initial,
  );

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-5"
    >
      <fieldset disabled={readOnly} className="space-y-5">
        <AmountField
          id="defaults-fee"
          label="Tarif par défaut"
          value={draft.defaultFee}
          onChange={(defaultFee) => patch({ defaultFee })}
          hint="Proposé comme tarif de chaque nouvelle campagne. Facultatif."
          error={errors.defaultFee}
          className="max-w-xs"
        />

        <PlatformListInput
          id="defaults-platform-new"
          value={draft.platforms}
          onChange={(platforms) => patch({ platforms })}
          onPendingChange={setPendingPlatform}
          error={errors.platforms}
        />

        <div role="group" aria-labelledby="defaults-stages-label" className="space-y-2">
          <p id="defaults-stages-label" className="text-sm leading-none font-medium">
            Étapes des dossiers
          </p>
          <p className="text-xs text-muted-foreground">
            Le parcours d&apos;un dossier, dans l&apos;ordre.
          </p>
          <StageListEditor
            idPrefix="defaults-stage"
            value={draft.stages}
            onChange={(stages) => patch({ stages })}
            errors={errors}
          />
        </div>
      </fieldset>
      {!readOnly && <SaveFooter saving={saving} saved={saved} dirty={dirty || pendingPlatform} error={error} />}
    </form>
  );
}
