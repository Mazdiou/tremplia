"use client";

import { useState } from "react";
import { TextField } from "@/components/form-fields";
import { SaveFooter, useSettingsSave } from "./save-footer";

// Nom, ville et téléphone de l'agence : le nom et le téléphone sont repris
// dans l'espace candidat et les messages WhatsApp
export function AgencyProfileForm({
  initial,
  readOnly,
}: {
  initial: { name: string; city: string; phone: string };
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const { save, dirty, saving, saved, error, errors } = useSettingsSave(
    "/api/settings/agency",
    draft,
    initial,
  );

  const patch = (p: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-5"
    >
      <fieldset disabled={readOnly} className="space-y-4">
        <TextField
          id="agency-name"
          label="Nom de l'agence"
          required
          maxLength={100}
          autoComplete="organization"
          value={draft.name}
          onChange={(name) => patch({ name })}
          error={errors.name}
        />
        <div className="grid gap-4 @md:grid-cols-2">
          <TextField
            id="agency-city"
            label="Ville"
            required
            maxLength={100}
            autoComplete="address-level2"
            value={draft.city}
            onChange={(city) => patch({ city })}
            error={errors.city}
          />
          <TextField
            id="agency-phone"
            label="Téléphone"
            type="tel"
            required
            maxLength={30}
            autoComplete="tel"
            value={draft.phone}
            onChange={(phone) => patch({ phone })}
            error={errors.phone}
          />
        </div>
      </fieldset>
      {!readOnly && <SaveFooter saving={saving} saved={saved} dirty={dirty} error={error} />}
    </form>
  );
}
