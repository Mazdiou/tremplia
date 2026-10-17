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
  const { save, touch, saving, saved, error, errors } = useSettingsSave("/api/settings/account");

  const patch = (p: Partial<typeof draft>) => {
    touch();
    setDraft((d) => ({ ...d, ...p }));
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void save(draft);
      }}
      className="space-y-5"
    >
      <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
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
      {!readOnly && <SaveFooter saving={saving} saved={saved} error={error} />}
    </form>
  );
}
