"use client";

import { KeyRound, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseFieldsDraft } from "@/features/cases/case-record";
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
import {
  ListHeader,
  RemoveButton,
  SelectField,
  TextField,
  optionsOf,
} from "@/components/form-fields";

// Listes répétables du formulaire de dossier. Chaque ligne a ses propres
// champs ; `errors` est indexé par chemin (« diplomas.0.year »).

type DiplomaDraft = CaseFieldsDraft["diplomas"][number];
type LanguageTestDraft = CaseFieldsDraft["languageTests"][number];
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

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick}>
      <Plus /> {label}
    </Button>
  );
}

// Le <legend> doit être l'enfant direct du <fieldset> pour en être le titre
function ListTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <legend className="flex w-full flex-wrap items-baseline justify-between gap-2">
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </legend>
  );
}

const DIPLOMA_GRID = "sm:grid-cols-[11rem_1fr_7rem_2.5rem]";

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
      <ListTitle title="Diplômes" hint={`${MAX_DIPLOMAS} au maximum`} />
      {value.length > 0 && (
        <ListHeader columns={["Type", "Intitulé", "Année", ""]} className={DIPLOMA_GRID} />
      )}
      {value.map((d, i) => (
        <div key={i} className={`grid items-start gap-3 ${DIPLOMA_GRID}`}>
          <SelectField
            id={`diploma-${i}-type`}
            label="Type"
            hideLabel
            required
            value={d.type}
            onChange={(type) => onChange(update(value, i, { type }))}
            options={optionsOf(DIPLOMA_TYPES, DIPLOMA_TYPE_LABELS)}
            placeholder="Choisir…"
            error={errors[`diplomas.${i}.type`]}
          />
          <TextField
            id={`diploma-${i}-title`}
            label="Intitulé"
            hideLabel
            placeholder="Ex. : Sciences expérimentales"
            value={d.title}
            maxLength={150}
            onChange={(title) => onChange(update(value, i, { title }))}
            error={errors[`diplomas.${i}.title`]}
          />
          <TextField
            id={`diploma-${i}-year`}
            label="Année"
            hideLabel
            type="number"
            placeholder={String(maxYear - 1)}
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
    </fieldset>
  );
}

const TEST_GRID = "sm:grid-cols-[1fr_1fr_10rem_2.5rem]";

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
      <ListTitle title="Tests de langue" hint={`${MAX_LANGUAGE_TESTS} au maximum`} />
      {value.length > 0 && (
        <ListHeader
          columns={["Test", "Résultat (niveau ou score)", "Date", ""]}
          className={TEST_GRID}
        />
      )}
      {value.map((t, i) => (
        <div key={i} className={`grid items-start gap-3 ${TEST_GRID}`}>
          <div className="space-y-2">
            <SelectField
              id={`test-${i}-test`}
              label="Test"
              hideLabel
              required
              value={t.test}
              onChange={(test) => onChange(update(value, i, { test }))}
              options={optionsOf(LANGUAGE_TESTS, LANGUAGE_TEST_LABELS)}
              placeholder="Choisir…"
              error={errors[`languageTests.${i}.test`]}
            />
            {t.test === "other" && (
              <TextField
                id={`test-${i}-other`}
                label="Nom du test"
                required
                placeholder="Nom du test"
                value={t.otherName}
                maxLength={100}
                onChange={(otherName) => onChange(update(value, i, { otherName }))}
                error={errors[`languageTests.${i}.otherName`]}
              />
            )}
          </div>
          <TextField
            id={`test-${i}-result`}
            label="Résultat (niveau ou score)"
            hideLabel
            placeholder="Ex. : B2, 6.5"
            value={t.result}
            maxLength={50}
            onChange={(result) => onChange(update(value, i, { result }))}
            error={errors[`languageTests.${i}.result`]}
          />
          <TextField
            id={`test-${i}-date`}
            label="Date"
            hideLabel
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
      <ListTitle title="Comptes externes" hint="Pastel, Parcoursup, Universitaly…" />
      <datalist id="platform-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {value.map((a, i) => (
        <div key={i} className="space-y-3 rounded-xl border bg-muted/30 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden />
            {a.platform.trim() || `Compte ${i + 1}`}
            <span className="ml-auto">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Retirer le compte ${i + 1}`}
                title="Retirer ce compte"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              id={`account-${i}-platform`}
              label="Plateforme"
              required
              list="platform-suggestions"
              placeholder="Choisir ou saisir"
              value={a.platform}
              maxLength={80}
              onChange={(platform) => onChange(update(value, i, { platform }))}
              error={errors[`externalAccounts.${i}.platform`]}
            />
            <SelectField
              id={`account-${i}-status`}
              label="Compte"
              required
              value={a.status}
              onChange={(status) =>
                onChange(
                  update(value, i, {
                    status,
                    password: status === "existing" ? a.password : "",
                  }),
                )
              }
              options={optionsOf(EXTERNAL_ACCOUNT_STATUSES, EXTERNAL_ACCOUNT_STATUS_LABELS)}
            />
            <TextField
              id={`account-${i}-url`}
              label="Adresse du site"
              type="url"
              placeholder="https://"
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
                hint={
                  passwordHint && !a.password
                    ? "Le mot de passe de l'ancien dossier n'est jamais repris : saisissez-le à nouveau."
                    : undefined
                }
                className="sm:col-span-2"
              />
            )}
          </div>
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
