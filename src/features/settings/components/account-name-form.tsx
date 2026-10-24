"use client";

import { useState } from "react";
import { TextField } from "@/components/form-fields";
import { SaveFooter, useSettingsSave } from "./save-footer";

// Prénom et nom du membre connecté (affichés à l'équipe et dans l'historique)
export function AccountNameForm({
  initial,
  readOnly,
}: {
  initial: { firstName: string; lastName: string };
  readOnly: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const { save, dirty, saving, saved, error, errors } = useSettingsSave(
    "/api/settings/account",
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
      <fieldset disabled={readOnly} className="grid gap-4 @md:grid-cols-2">
        <TextField
          id="account-first-name"
          label="Prénom"
          required
          maxLength={100}
          autoComplete="given-name"
          value={draft.firstName}
          onChange={(firstName) => patch({ firstName })}
          error={errors.firstName}
        />
        <TextField
          id="account-last-name"
          label="Nom"
          required
          maxLength={100}
          autoComplete="family-name"
          value={draft.lastName}
          onChange={(lastName) => patch({ lastName })}
          error={errors.lastName}
        />
      </fieldset>
      {!readOnly && <SaveFooter saving={saving} saved={saved} dirty={dirty} error={error} />}
    </form>
  );
}
