"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { CaseFieldsDraft } from "@/features/cases/case-record";
import {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
} from "@/features/cases/labels";
import { MAX_NOTE_LENGTH } from "@/features/notes/schemas";
import {
  AccountsEditor,
  DiplomasEditor,
  LanguageTestsEditor,
  type AccountDraft,
} from "./case-form-lists";
import {
  SelectField,
  TextAreaField,
  TextField,
  optionsOf,
} from "./form-fields";
import { ImportPanel, type ImportMatch, type SourceCampaign } from "./import-panel";

export type FormCampaign = {
  id: string;
  name: string;
  groups: { id: string; name: string }[];
  suggestedPlatforms: string[];
};

export type Member = {
  id: string;
  first_name: string;
  last_name: string;
  is_active?: boolean;
};

const EMPTY_FIELDS: CaseFieldsDraft = {
  firstName: "",
  lastName: "",
  birthDate: "",
  phone: "",
  email: "",
  city: "",
  nationality: "",
  secondaryContactName: "",
  secondaryContactPhone: "",
  educationLevel: "",
  currentField: "",
  currentInstitution: "",
  diplomas: [],
  languageTests: [],
};

// Champs envoyés à l'API : années en nombres, le reste tel quel (le serveur
// valide et nettoie, vide = absent).
function toPayload(f: CaseFieldsDraft) {
  return {
    ...f,
    diplomas: f.diplomas.map((d) => ({
      ...d,
      year: d.year.trim() === "" ? null : Number(d.year),
    })),
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function CaseForm(
  props:
    | {
        mode: "create";
        campaigns: FormCampaign[];
        defaultCampaignId: string | null;
        sources: SourceCampaign[];
        platformSuggestions: string[];
        members: Member[];
        isOwner: boolean;
        currentUserId: string;
      }
    | {
        mode: "edit";
        caseId: string;
        campaign: FormCampaign;
        initial: { fields: CaseFieldsDraft; groupIds: string[]; assignedTo: string | null };
        members: Member[];
        isOwner: boolean;
        currentUserId: string;
      },
) {
  const router = useRouter();
  const isEdit = props.mode === "edit";
  const campaigns = isEdit ? [props.campaign] : props.campaigns;

  const [campaignId, setCampaignId] = useState(
    isEdit ? props.campaign.id : (props.defaultCampaignId ?? ""),
  );
  const [groupIds, setGroupIds] = useState<string[]>(
    isEdit ? props.initial.groupIds : [],
  );
  const [fields, setFields] = useState<CaseFieldsDraft>(
    isEdit ? props.initial.fields : EMPTY_FIELDS,
  );
  const [assignedTo, setAssignedTo] = useState(
    isEdit ? (props.initial.assignedTo ?? "") : props.currentUserId,
  );
  const [accounts, setAccounts] = useState<AccountDraft[]>([]);
  const [initialNote, setInitialNote] = useState("");
  const [imported, setImported] = useState<SourceCampaign | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<string[] | null>(null);

  const campaign = campaigns.find((c) => c.id === campaignId) ?? null;
  const set = <K extends keyof CaseFieldsDraft>(key: K) =>
    (value: CaseFieldsDraft[K]) => setFields((f) => ({ ...f, [key]: value }));

  // Aucune campagne active : rien à créer
  if (!isEdit && campaigns.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        Aucune campagne active.{" "}
        {props.isOwner ? (
          <>
            <Link href="/campaigns" className="underline">
              Créez une campagne ou importez un modèle
            </Link>{" "}
            pour ajouter des dossiers.
          </>
        ) : (
          "Prévenez le patron : il doit créer une campagne avant que vous puissiez ajouter des dossiers."
        )}
      </p>
    );
  }

  function handleImport(m: ImportMatch, source: SourceCampaign) {
    setFields(m.fields);
    setAccounts(
      m.externalAccounts.map((a) => ({ ...a, password: "" })),
    );
    setImported(source);
    setError(null);
    setFieldErrors({});
    setDuplicates(null);
  }

  async function submit(confirmDuplicate = false) {
    setError(null);
    setFieldErrors({});
    setLoading(true);

    let res: Response;
    if (isEdit) {
      res = await fetch(`/api/cases/${props.caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...toPayload(fields),
          assignedTo: props.isOwner ? assignedTo : "",
        }),
      });
      const changedGroups =
        [...groupIds].sort().join() !== [...props.initial.groupIds].sort().join();
      if (res.ok && changedGroups) {
        res = await fetch(`/api/cases/${props.caseId}/groups`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupIds }),
        });
      }
    } else {
      res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          groupIds,
          assignedTo: props.isOwner ? assignedTo : "",
          ...toPayload(fields),
          externalAccounts: accounts.map((a) => ({
            ...a,
            password: a.status === "existing" ? a.password : "",
          })),
          initialNote,
          sourceCampaignId: imported?.id ?? "",
          confirmDuplicate,
        }),
      });
    }
    setLoading(false);

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (data?.code === "possible_duplicate" && Array.isArray(data.duplicates)) {
        setDuplicates(data.duplicates as string[]);
        return;
      }
      if (Array.isArray(data?.fields)) {
        const map: Record<string, string> = {};
        for (const f of data.fields as { path: string; message: string }[]) {
          map[f.path] ??= f.message;
        }
        setFieldErrors(map);
      }
      setError(data?.error ?? `Erreur serveur (${res.status})`);
      return;
    }

    const id = isEdit ? props.caseId : (data.id as string);
    router.push(`/cases/${id}`);
    router.refresh();
  }

  const e = fieldErrors;
  const levelOptions = optionsOf(EDUCATION_LEVELS, EDUCATION_LEVEL_LABELS);

  return (
    <div className="space-y-5">
      {!isEdit && (
        <ImportPanel
          sources={props.sources.filter((s) => s.id !== campaignId)}
          onImport={handleImport}
        />
      )}

      {imported && (
        <div className="rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <p className="font-medium">Données importées de « {imported.name} ».</p>
          <p className="mt-1">
            Vérifiez-les et modifiez ce qui a changé (le niveau d&apos;études,
            par exemple). Les mots de passe des comptes sont à ressaisir.
          </p>
        </div>
      )}

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          void submit();
        }}
        className="space-y-5"
        noValidate
      >
        <Section title="Rattachement">
          <SelectField
            id="campaignId"
            label="Campagne"
            required
            value={campaignId}
            disabled={isEdit}
            onChange={(v) => {
              setCampaignId(v);
              // Les groupes appartiennent à la campagne choisie
              setGroupIds([]);
            }}
            placeholder="Choisir une campagne..."
            options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
            error={e.campaignId}
          />
          {campaign && campaign.groups.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Groupes (facultatif)</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {campaign.groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={groupIds.includes(g.id)}
                      onChange={(ev) =>
                        setGroupIds((ids) =>
                          ev.target.checked
                            ? [...ids, g.id]
                            : ids.filter((x) => x !== g.id),
                        )
                      }
                    />
                    {g.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </Section>

        <Section title="Identité">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="lastName" label="Nom" required maxLength={100}
              value={fields.lastName} onChange={set("lastName")} error={e.lastName} />
            <TextField id="firstName" label="Prénom" required maxLength={100}
              value={fields.firstName} onChange={set("firstName")} error={e.firstName} />
            <TextField id="birthDate" label="Date de naissance" type="date" required
              value={fields.birthDate} onChange={set("birthDate")} error={e.birthDate} />
            <TextField id="phone" label="Téléphone" type="tel" required maxLength={30}
              value={fields.phone} onChange={set("phone")} error={e.phone} />
            <TextField id="email" label="E-mail" type="email" maxLength={254}
              value={fields.email} onChange={set("email")} error={e.email} />
            <TextField id="city" label="Ville ou wilaya" maxLength={100}
              value={fields.city} onChange={set("city")} error={e.city} />
            <TextField id="nationality" label="Nationalité" maxLength={100}
              value={fields.nationality} onChange={set("nationality")} error={e.nationality} />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Contact secondaire (un parent, par exemple)
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField id="secondaryContactName" label="Nom" maxLength={100}
                value={fields.secondaryContactName} onChange={set("secondaryContactName")}
                error={e.secondaryContactName} />
              <TextField id="secondaryContactPhone" label="Téléphone" type="tel" maxLength={30}
                value={fields.secondaryContactPhone} onChange={set("secondaryContactPhone")}
                error={e.secondaryContactPhone} />
            </div>
          </fieldset>
        </Section>

        <Section title="Parcours">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField id="educationLevel" label="Niveau d'études atteint" required
              value={fields.educationLevel} onChange={set("educationLevel")}
              options={levelOptions} placeholder="Choisir..." error={e.educationLevel} />
            <span aria-hidden className="max-sm:hidden" />
            <TextField id="currentField" label="Filière ou spécialité actuelle" maxLength={150}
              value={fields.currentField} onChange={set("currentField")} error={e.currentField} />
            <TextField id="currentInstitution" label="Établissement actuel" maxLength={150}
              value={fields.currentInstitution} onChange={set("currentInstitution")}
              error={e.currentInstitution} />
          </div>
          <DiplomasEditor value={fields.diplomas} onChange={set("diplomas")} errors={e} />
          <LanguageTestsEditor value={fields.languageTests} onChange={set("languageTests")}
            errors={e} />
        </Section>

        <Section title="Suivi">
          {props.isOwner ? (
            <SelectField
              id="assignedTo"
              label="Responsable du dossier"
              value={assignedTo}
              onChange={setAssignedTo}
              placeholder={isEdit && !props.initial.assignedTo ? "Aucun (non attribué)" : undefined}
              options={props.members.map((m) => ({
                value: m.id,
                label: `${m.first_name} ${m.last_name}${m.id === props.currentUserId ? " (moi)" : ""}${m.is_active === false ? " (inactif)" : ""}`,
              }))}
              error={e.assignedTo}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? "Seul le patron peut changer le responsable du dossier."
                : "Ce dossier vous sera attribué automatiquement."}
            </p>
          )}

          {isEdit ? (
            <p className="text-sm text-muted-foreground">
              Les comptes externes se gèrent dans l&apos;en-tête du dossier.
            </p>
          ) : (
            <>
              <AccountsEditor
                value={accounts}
                onChange={setAccounts}
                errors={e}
                suggestions={[
                  ...(campaign?.suggestedPlatforms ?? []),
                  ...props.platformSuggestions,
                ].filter((p, i, all) => all.indexOf(p) === i)}
                passwordHint={imported !== null}
              />
              {e.externalAccounts && (
                <p className="text-sm text-red-600">{e.externalAccounts}</p>
              )}
              <TextAreaField id="initialNote" label="Note initiale" maxLength={MAX_NOTE_LENGTH}
                value={initialNote} onChange={setInitialNote} error={e.initialNote} />
            </>
          )}
        </Section>

        {duplicates && (
          <div
            role="alert"
            className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
          >
            <p className="font-medium">
              Un dossier avec ce nom, ce prénom et cette date de naissance
              existe déjà dans cette campagne.
            </p>
            <ul className="list-inside list-disc">
              {duplicates.map((id) => (
                <li key={id}>
                  <Link href={`/cases/${id}`} target="_blank" className="underline">
                    Ouvrir le dossier existant
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={loading} onClick={() => void submit(true)}>
                Créer quand même
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setDuplicates(null)}>
                Annuler
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button type="submit" disabled={loading || duplicates !== null} className="flex-1">
            {loading
              ? "Enregistrement..."
              : isEdit
                ? "Enregistrer les modifications"
                : "Créer le dossier"}
          </Button>
          {isEdit && (
            <Link
              href={`/cases/${props.caseId}`}
              className="inline-flex h-8 items-center rounded-lg border px-3 text-sm hover:bg-muted"
            >
              Annuler
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
