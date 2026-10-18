"use client";

import { useState } from "react";
import { CalendarDays, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, SelectField, TextAreaField } from "@/components/form-fields";
import { callApi, type ApiResult } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { quickDueDates } from "@/features/tasks/due";
import { MAX_TASK_DETAILS, MAX_TASK_TITLE, taskSchema, type TaskInput } from "@/features/tasks/schemas";
import type { TaskFormContext, TaskItem } from "@/features/tasks/types";

const CHIP =
  "h-8 touch-manipulation rounded-full border px-3 text-xs font-medium transition-colors hover:bg-muted aria-pressed:border-primary aria-pressed:bg-accent aria-pressed:text-accent-foreground";

// Nouvelle tâche (sans `task`) ou modification. `onSaved` reçoit le message
// à afficher. `save` remplace l'envoi habituel (actions groupées : la même
// tâche pour plusieurs dossiers).
export function TaskForm({
  context,
  task,
  autoFocus,
  save,
  submitLabel,
  onSaved,
  onCancel,
}: {
  context: TaskFormContext;
  task?: TaskItem;
  autoFocus?: boolean;
  save?: (input: TaskInput) => Promise<ApiResult<unknown>>;
  submitLabel?: string;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const { caseId, members, currentUserId, today } = context;
  const idPrefix = task ? `task-${task.id}` : "task-new";
  const [title, setTitle] = useState(task?.title ?? "");
  const [details, setDetails] = useState(task?.details ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo ?? currentUserId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Membres actifs (moi d'abord), plus le responsable actuel s'il est désactivé
  const options = members
    .filter((m) => m.isActive || m.id === task?.assignedTo)
    .sort((a, b) => (a.id === currentUserId ? -1 : b.id === currentUserId ? 1 : 0))
    .map((m) => ({
      value: m.id,
      label: `${m.name}${m.id === currentUserId ? " (moi)" : ""}${m.isActive ? "" : " (désactivé)"}`,
    }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = taskSchema.safeParse({ title, details, dueDate, assignedTo });
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    const res = save
      ? await save(parsed.data)
      : await callApi(
          task ? `/api/cases/${caseId}/tasks/${task.id}` : `/api/cases/${caseId}/tasks`,
          { method: task ? "PATCH" : "POST", body: parsed.data },
        );
    setSaving(false);
    if (!res.ok) {
      setFormError(res.error);
      return;
    }
    onSaved(task ? "Tâche modifiée" : "Tâche ajoutée");
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      className="space-y-4"
      noValidate
    >
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-title`} className="gap-0.5">
          Tâche
          <span aria-hidden className="text-destructive">*</span>
        </Label>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          autoFocus={autoFocus}
          maxLength={MAX_TASK_TITLE}
          placeholder="Ex. : Appeler pour le relevé de notes du bac"
          onChange={(e) => setTitle(e.target.value)}
          aria-invalid={errors.title ? true : undefined}
        />
        <FieldError message={errors.title} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm leading-none font-medium">Échéance</legend>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {quickDueDates(today).map((q) => (
            <button
              key={q.label}
              type="button"
              aria-pressed={dueDate === q.date}
              onClick={() => setDueDate(q.date)}
              className={CHIP}
            >
              {q.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={dueDate === ""}
            onClick={() => setDueDate("")}
            className={CHIP}
          >
            Sans échéance
          </button>
        </div>
        <div className="relative w-full max-w-48">
          <CalendarDays
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="date"
            aria-label="Autre date"
            value={dueDate}
            min="2020-01-01"
            max="2100-12-31"
            onChange={(e) => setDueDate(e.target.value)}
            className={cn("pl-9", !dueDate && "text-muted-foreground")}
            aria-invalid={errors.dueDate ? true : undefined}
          />
        </div>
        <FieldError message={errors.dueDate} />
      </fieldset>

      <SelectField
        id={`${idPrefix}-assignee`}
        label="Confiée à"
        value={assignedTo}
        onChange={setAssignedTo}
        options={options}
        error={errors.assignedTo}
        required
        className="max-w-sm"
      />

      <TextAreaField
        id={`${idPrefix}-details`}
        label="Précision (facultatif)"
        value={details}
        onChange={setDetails}
        maxLength={MAX_TASK_DETAILS}
        error={errors.details}
        placeholder="Ex. : il manque celui de terminale"
      />

      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {submitLabel ?? (task ? "Enregistrer" : "Ajouter la tâche")}
        </Button>
      </div>
    </form>
  );
}
