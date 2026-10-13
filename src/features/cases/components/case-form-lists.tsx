"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DIPLOMA_TYPES,
  DIPLOMA_TYPE_LABELS,
  EXTERNAL_ACCOUNT_STATUSES,
  EXTERNAL_ACCOUNT_STATUS_LABELS,
  LANGUAGE_TESTS,
  LANGUAGE_TEST_LABELS,
  MAX_DIPLOMAS,
  MAX_EXTERNAL_ACCOUNTS,
  MAX_LANGUAGE_TESTS,
} from "@/features/cases/labels";
import { SelectField, TextField, optionsOf } from "./form-fields";

// Listes répétables du formulaire de dossier. Chaque ligne a ses propres
// champs ; `errors` est indexé par chemin (« diplomas.0.year »).

export type DiplomaDraft = { type: string; title: string; year: string };
export type LanguageTestDraft = {
  test: string;
  otherName: string;
  result: string;
  date: string;
};
export type AccountDraft = {
  platform: string;
  url: string;
  login: string;
  status: string;
  password: string;
};

type Errors = Record<string, string>;

function update<T>(list: T[], index: number, patch: Partial<T>) {
  return list.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="mt-6"
    >
      <Trash2 />
    </Button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      <Plus /> {label}
    </Button>
  );
}

export function DiplomasEditor({
  value,
  onChange,
  errors,
}: {
  value: DiplomaDraft[];
  onChange: (next: DiplomaDraft[]) => void;
  errors: Errors;
}) {
  const maxYear = new Date().getFullYear() + 1;
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Diplômes</legend>
      {value.map((d, i) => (
        <div key={i} className="grid items-start gap-3 sm:grid-cols-[10rem_1fr_7rem_auto]">
          <SelectField
            id={`diploma-${i}-type`}
            label="Type"
            required
            value={d.type}
            onChange={(type) => onChange(update(value, i, { type }))}
            options={optionsOf(DIPLOMA_TYPES, DIPLOMA_TYPE_LABELS)}
            placeholder="Choisir..."
            error={errors[`diplomas.${i}.type`]}
          />
          <TextField
            id={`diploma-${i}-title`}
            label="Intitulé"
            value={d.title}
            maxLength={150}
            onChange={(title) => onChange(update(value, i, { title }))}
            error={errors[`diplomas.${i}.title`]}
          />
          <TextField
            id={`diploma-${i}-year`}
            label="Année"
            type="number"
            value={d.year}
            onChange={(year) => onChange(update(value, i, { year }))}
            error={errors[`diplomas.${i}.year`]}
          />
          <RemoveButton
            label={`Retirer le diplôme ${i + 1}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {value.length < MAX_DIPLOMAS && (
        <AddButton
          label="Ajouter un diplôme"
          onClick={() => onChange([...value, { type: "", title: "", year: "" }])}
        />
      )}
      <p className="text-xs text-muted-foreground">
        Année entre 1950 et {maxYear}. {MAX_DIPLOMAS} diplômes au maximum.
      </p>
    </fieldset>
  );
}

export function LanguageTestsEditor({
  value,
  onChange,
  errors,
}: {
  value: LanguageTestDraft[];
  onChange: (next: LanguageTestDraft[]) => void;
  errors: Errors;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Tests de langue</legend>
      {value.map((t, i) => (
        <div key={i} className="grid items-start gap-3 sm:grid-cols-[8rem_1fr_1fr_9rem_auto]">
          <SelectField
            id={`test-${i}-test`}
            label="Test"
            required
            value={t.test}
            onChange={(test) => onChange(update(value, i, { test }))}
            options={optionsOf(LANGUAGE_TESTS, LANGUAGE_TEST_LABELS)}
            placeholder="Choisir..."
            error={errors[`languageTests.${i}.test`]}
          />
          {t.test === "other" ? (
            <TextField
              id={`test-${i}-other`}
              label="Nom du test"
              required
              value={t.otherName}
              maxLength={100}
              onChange={(otherName) => onChange(update(value, i, { otherName }))}
              error={errors[`languageTests.${i}.otherName`]}
            />
          ) : (
            <span aria-hidden className="max-sm:hidden" />
          )}
          <TextField
            id={`test-${i}-result`}
            label="Résultat (niveau ou score)"
            value={t.result}
            maxLength={50}
            onChange={(result) => onChange(update(value, i, { result }))}
            error={errors[`languageTests.${i}.result`]}
          />
          <TextField
            id={`test-${i}-date`}
            label="Date"
            type="date"
            value={t.date}
            onChange={(date) => onChange(update(value, i, { date }))}
            error={errors[`languageTests.${i}.date`]}
          />
          <RemoveButton
            label={`Retirer le test ${i + 1}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {value.length < MAX_LANGUAGE_TESTS && (
        <AddButton
          label="Ajouter un test"
          onClick={() =>
            onChange([...value, { test: "", otherName: "", result: "", date: "" }])
          }
        />
      )}
    </fieldset>
  );
}

export function AccountsEditor({
  value,
  onChange,
  errors,
  suggestions,
  passwordHint,
}: {
  value: AccountDraft[];
  onChange: (next: AccountDraft[]) => void;
  errors: Errors;
  suggestions: string[];
  // Comptes repris d'une autre campagne : le mot de passe est à ressaisir
  passwordHint: boolean;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium">Comptes externes</legend>
      <datalist id="platform-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {value.map((a, i) => (
        <div key={i} className="space-y-3 rounded-lg border p-3">
          <div className="grid items-start gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1">
              <label htmlFor={`account-${i}-platform`} className="text-sm font-medium">
                Plateforme<span aria-hidden> *</span>
              </label>
              <input
                id={`account-${i}-platform`}
                list="platform-suggestions"
                value={a.platform}
                maxLength={80}
                required
                onChange={(e) => onChange(update(value, i, { platform: e.target.value }))}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              {errors[`externalAccounts.${i}.platform`] && (
                <p className="text-sm text-red-600">
                  {errors[`externalAccounts.${i}.platform`]}
                </p>
              )}
            </div>
            <SelectField
              id={`account-${i}-status`}
              label="Compte"
              required
              value={a.status}
              onChange={(status) =>
                onChange(update(value, i, { status, password: status === "existing" ? a.password : "" }))
              }
              options={optionsOf(EXTERNAL_ACCOUNT_STATUSES, EXTERNAL_ACCOUNT_STATUS_LABELS)}
            />
            <RemoveButton
              label={`Retirer le compte ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField
              id={`account-${i}-url`}
              label="Adresse du site"
              type="url"
              value={a.url}
              onChange={(url) => onChange(update(value, i, { url }))}
              error={errors[`externalAccounts.${i}.url`]}
            />
            <TextField
              id={`account-${i}-login`}
              label="Identifiant"
              required={a.status === "existing"}
              autoComplete="off"
              value={a.login}
              maxLength={254}
              onChange={(login) => onChange(update(value, i, { login }))}
              error={errors[`externalAccounts.${i}.login`]}
            />
            {a.status === "existing" && (
              <TextField
                id={`account-${i}-password`}
                label="Mot de passe"
                type="password"
                required
                autoComplete="new-password"
                value={a.password}
                onChange={(password) => onChange(update(value, i, { password }))}
                error={errors[`externalAccounts.${i}.password`]}
              />
            )}
          </div>
          {passwordHint && a.status === "existing" && !a.password && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Le mot de passe de l&apos;ancien dossier n&apos;est jamais repris :
              saisissez-le à nouveau.
            </p>
          )}
        </div>
      ))}
      {value.length < MAX_EXTERNAL_ACCOUNTS && (
        <AddButton
          label="Ajouter un compte"
          onClick={() =>
            onChange([
              ...value,
              { platform: "", url: "", login: "", status: "to_create", password: "" },
            ])
          }
        />
      )}
      <p className="text-xs text-muted-foreground">
        Les mots de passe sont chiffrés avant d&apos;être enregistrés et
        n&apos;apparaissent jamais dans les listes ni dans le journal.
      </p>
    </fieldset>
  );
}
