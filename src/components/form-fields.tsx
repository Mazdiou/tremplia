"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Petits champs de formulaire partagés : un libellé toujours lié à son champ
// (masqué visuellement dans les lignes de liste, où une ligne d'en-tête
// nomme les colonnes), et l'erreur juste en dessous.

// Même apparence que <Input> : hauteur, bordure, fond, focus
export const selectClass =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive dark:bg-input/30";

const textareaClass =
  "min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30";

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

function FieldLabel({
  htmlFor,
  label,
  required,
  hidden,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  hidden?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className={cn("gap-0.5", hidden && "sm:sr-only")}>
      {label}
      {required && (
        <span aria-hidden className="text-destructive">
          *
        </span>
      )}
    </Label>
  );
}

type Common = {
  id: string;
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
  // Libellé masqué à partir de la largeur tablette (une ligne d'en-tête
  // nomme alors les colonnes), toujours lu par les lecteurs d'écran
  hideLabel?: boolean;
  hint?: string;
};

export function TextField({
  id,
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  maxLength,
  className,
  autoComplete,
  hideLabel,
  hint,
  placeholder,
}: Common & {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  maxLength?: number;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel htmlFor={id} label={label} required={required} hidden={hideLabel} />
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
      />
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

export function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  required,
  placeholder,
  disabled,
  className,
  hideLabel,
  hint,
}: Common & {
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel htmlFor={id} label={label} required={required} hidden={hideLabel} />
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className={selectClass}
        aria-invalid={error ? true : undefined}
      >
        {placeholder !== undefined && (
          <option value="" disabled={required}>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError message={error} />
    </div>
  );
}

export function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  maxLength,
  className,
  placeholder,
}: Common & {
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <FieldLabel htmlFor={id} label={label} />
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className={textareaClass}
        aria-invalid={error ? true : undefined}
      />
      <div className="flex justify-between gap-2">
        <FieldError message={error} />
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {value.length}/{maxLength}
        </span>
      </div>
    </div>
  );
}

// En-tête des colonnes d'une liste répétable (dates, diplômes…) : affiché
// une seule fois au lieu de répéter les libellés sur chaque ligne.
export function ListHeader({
  columns,
  className,
}: {
  columns: string[];
  className: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "hidden gap-3 px-1 text-xs font-medium text-muted-foreground sm:grid",
        className,
      )}
    >
      {columns.map((c, i) => (
        <span key={i}>{c}</span>
      ))}
    </div>
  );
}

// Bouton « Retirer » d'une ligne de liste répétable
export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-destructive max-sm:mt-6"
    >
      <Trash2 />
    </Button>
  );
}

// Options d'un <select> à partir d'une liste métier et de ses libellés
export function optionsOf<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
) {
  return values.map((v) => ({ value: v, label: labels[v] }));
}
