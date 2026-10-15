"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  GraduationCap,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PILL_TONE_CLASSES, StatusPill } from "@/components/page-ui";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SelectField, TextField, optionsOf } from "@/components/form-fields";
import {
  MAX_PROGRAMS,
  PROGRAM_LEVELS,
  PROGRAM_LEVEL_LABELS,
  PROGRAM_RESULTS,
  PROGRAM_RESULT_LABELS,
  PROGRAM_RESULT_TONES,
  programLevelLabel,
  programResult,
  programResultsSummary,
  type ProgramResult,
} from "@/features/programs/schemas";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type ProgramItem = {
  id: string;
  title: string;
  level: string;
  city: string;
  institution: string | null;
  // Réponse de l'établissement (voir PROGRAM_RESULTS)
  result: string;
};

type Draft = { title: string; level: string; city: string; institution: string };
const EMPTY: Draft = { title: "", level: "", city: "", institution: "" };
const levelOptions = optionsOf(PROGRAM_LEVELS, PROGRAM_LEVEL_LABELS);

// Réponse de l'établissement en lecture seule (espace candidat) : rien tant
// qu'il n'y en a pas
export function ProgramResultPill({ result }: { result: string }) {
  const r = programResult(result);
  if (r === "none") return null;
  return <StatusPill tone={PROGRAM_RESULT_TONES[r]}>{PROGRAM_RESULT_LABELS[r]}</StatusPill>;
}

// Ligne d'une formation : rang, intitulé, niveau, ville et établissement,
// puis la réponse de l'établissement. Partagée avec l'espace candidat (sans
// les actions, réponse en lecture seule).
export function ProgramRow({
  rank,
  program,
  actions,
  result,
}: {
  rank: number;
  program: ProgramItem;
  actions?: React.ReactNode;
  result?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular-nums">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium break-words">{program.title}</span>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
            {programLevelLabel(program.level)}
          </span>
        </p>
        <p className="mt-0.5 flex items-start gap-1 text-sm text-muted-foreground">
          <MapPin className="mt-[3px] size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            {program.city}
            {program.institution && ` · ${program.institution}`}
          </span>
        </p>
        {result && <div className="mt-1.5">{result}</div>}
      </div>
      {actions}
    </li>
  );
}

// Sélecteur de réponse, avec l'aspect et la couleur d'une pastille
function ResultSelect({
  program,
  disabled,
  onChange,
}: {
  program: ProgramItem;
  disabled: boolean;
  onChange: (result: ProgramResult) => void;
}) {
  const r = programResult(program.result);
  return (
    <select
      aria-label={`Réponse de l'établissement pour ${program.title}`}
      value={r}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ProgramResult)}
      className={cn(
        "h-6 cursor-pointer rounded-full border-0 py-0 pr-6 pl-2.5 text-xs font-medium",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60",
        PILL_TONE_CLASSES[PROGRAM_RESULT_TONES[r]],
      )}
    >
      {PROGRAM_RESULTS.map((value) => (
        <option key={value} value={value}>
          {PROGRAM_RESULT_LABELS[value]}
        </option>
      ))}
    </select>
  );
}

function ProgramForm({
  initial,
  submitLabel,
  saving,
  errors,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  saving: boolean;
  errors: Record<string, string>;
  onSubmit: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const set = (key: keyof Draft) => (value: string) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <form
      noValidate
      className="space-y-4 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="program-title" label="Intitulé de la formation" required
          maxLength={200} value={draft.title} onChange={set("title")}
          placeholder="Ex. : Licence Informatique" error={errors.title}
          className="sm:col-span-2" />
        <SelectField id="program-level" label="Niveau" required value={draft.level}
          onChange={set("level")} options={levelOptions} placeholder="Choisir..."
          error={errors.level} />
        <TextField id="program-city" label="Ville" required maxLength={100}
          value={draft.city} onChange={set("city")} placeholder="Ex. : Lyon"
          error={errors.city} />
        <TextField id="program-institution" label="Établissement" maxLength={150}
          value={draft.institution} onChange={set("institution")}
          placeholder="Ex. : Université Lyon 1" hint="Facultatif"
          error={errors.institution} className="sm:col-span-2" />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function ProgramsPanel({
  caseId,
  programs,
}: {
  caseId: string;
  programs: ProgramItem[];
}) {
  const router = useRouter();
  const base = `/api/cases/${caseId}/programs`;

  // "new" : formulaire d'ajout ; un id : formulaire de modification
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ProgramItem | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const full = programs.length >= MAX_PROGRAMS;

  function open(target: string | null) {
    setMessage(null);
    setFieldErrors({});
    setEditing(target);
  }

  async function save(draft: Draft) {
    const isNew = editing === "new";
    setSaving(true);
    setMessage(null);
    const res = await callApi(isNew ? base : `${base}/${editing}`, {
      method: isNew ? "POST" : "PATCH",
      body: draft,
    });
    setSaving(false);
    if (!res.ok) {
      setFieldErrors(res.fieldErrors);
      if (Object.keys(res.fieldErrors).length === 0) {
        setMessage({ text: res.error, error: true });
      }
      return;
    }
    setEditing(null);
    setMessage({ text: isNew ? "Formation ajoutée" : "Formation modifiée", error: false });
    router.refresh();
  }

  async function move(id: string, direction: -1 | 1) {
    setBusyId(id);
    setMessage(null);
    const res = await callApi(`${base}/${id}/move`, { body: { direction } });
    setBusyId(null);
    if (!res.ok) setMessage({ text: res.error, error: true });
    router.refresh();
  }

  async function setResult(id: string, result: ProgramResult) {
    setBusyId(id);
    setMessage(null);
    const res = await callApi(`${base}/${id}/result`, { method: "PUT", body: { result } });
    setBusyId(null);
    setMessage(
      res.ok
        ? { text: `Réponse notée : ${PROGRAM_RESULT_LABELS[result]}`, error: false }
        : { text: res.error, error: true },
    );
    router.refresh();
  }

  async function remove() {
    if (!toDelete) return;
    setBusyId(toDelete.id);
    const res = await callApi(`${base}/${toDelete.id}`, { method: "DELETE" });
    setBusyId(null);
    setToDelete(null);
    setMessage(
      res.ok
        ? { text: "Formation supprimée", error: false }
        : { text: res.error, error: true },
    );
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Formations visées</h2>
          <p className="text-sm text-muted-foreground">
            Par ordre de préférence · {programs.length} / {MAX_PROGRAMS}
          </p>
          {programs.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Réponses : {programResultsSummary(programs.map((p) => p.result))}
            </p>
          )}
        </div>
        {editing !== "new" && (
          <Button disabled={full} onClick={() => open("new")}
            title={full ? `${MAX_PROGRAMS} formations au maximum` : undefined}>
            <Plus /> Ajouter une formation
          </Button>
        )}
      </div>

      {editing === "new" && (
        <ProgramForm initial={EMPTY} submitLabel="Ajouter" saving={saving}
          errors={fieldErrors} onSubmit={(d) => void save(d)} onCancel={() => open(null)} />
      )}

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "min-h-5 px-1 text-sm",
          message?.error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </p>

      {programs.length === 0 ? (
        editing !== "new" && (
          <div className="rounded-xl border border-dashed px-6 py-12 text-center">
            <GraduationCap className="mx-auto size-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">Aucune formation pour ce dossier</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez les formations visées par le candidat, de la préférée à la moins
              souhaitée.
            </p>
          </div>
        )
      ) : (
        <ol className="divide-y rounded-xl border bg-card">
          {programs.map((p, i) =>
            editing === p.id ? (
              <li key={p.id} className="p-2">
                <ProgramForm
                  initial={{
                    title: p.title,
                    level: p.level,
                    city: p.city,
                    institution: p.institution ?? "",
                  }}
                  submitLabel="Enregistrer"
                  saving={saving}
                  errors={fieldErrors}
                  onSubmit={(d) => void save(d)}
                  onCancel={() => open(null)}
                />
              </li>
            ) : (
              <ProgramRow
                key={p.id}
                rank={i + 1}
                program={p}
                result={
                  <ResultSelect
                    program={p}
                    disabled={busyId !== null}
                    onChange={(r) => void setResult(p.id, r)}
                  />
                }
                actions={
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button variant="ghost" size="icon-sm" title="Monter"
                      aria-label={`Monter ${p.title}`}
                      disabled={i === 0 || busyId !== null}
                      onClick={() => void move(p.id, -1)}>
                      <ArrowUp />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Descendre"
                      aria-label={`Descendre ${p.title}`}
                      disabled={i === programs.length - 1 || busyId !== null}
                      onClick={() => void move(p.id, 1)}>
                      <ArrowDown />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Modifier"
                      aria-label={`Modifier ${p.title}`}
                      onClick={() => open(p.id)}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" title="Supprimer"
                      aria-label={`Supprimer ${p.title}`}
                      disabled={busyId !== null}
                      onClick={() => setToDelete(p)}>
                      <Trash2 />
                    </Button>
                  </div>
                }
              />
            ),
          )}
        </ol>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Supprimer cette formation ?"
        body={toDelete ? `« ${toDelete.title} » sera retirée de la liste.` : ""}
        confirmLabel="Supprimer"
        danger
        loading={busyId !== null}
        onConfirm={() => void remove()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
