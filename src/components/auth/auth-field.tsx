"use client";

import { useId, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = Omit<React.ComponentProps<"input">, "id"> & {
  label: string;
  icon?: LucideIcon;
  trailing?: React.ReactNode;
  hint?: string;
  error?: string | null;
  id?: string;
};

// Champ de formulaire : libellé, icône à gauche, aide et message d'erreur.
export function AuthField({
  label,
  icon: Icon,
  trailing,
  hint,
  error,
  className,
  id,
  ...props
}: FieldProps) {
  const auto = useId();
  const fieldId = id ?? auto;
  const describedBy = error
    ? `${fieldId}-error`
    : hint
      ? `${fieldId}-hint`
      : undefined;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
        )}
        <Input
          id={fieldId}
          className={cn(Icon && "pl-9", className)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
        {trailing}
      </div>
      {error ? (
        <p
          id={`${fieldId}-error`}
          role="alert"
          className="text-sm text-destructive"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// Champ mot de passe avec bouton afficher / masquer.
export function PasswordField({
  className,
  ...props
}: Omit<FieldProps, "type" | "icon" | "trailing">) {
  const [visible, setVisible] = useState(false);
  const Toggle = visible ? EyeOff : Eye;

  return (
    <AuthField
      {...props}
      icon={Lock}
      type={visible ? "text" : "password"}
      className={cn("pr-10", className)}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={
            visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          aria-pressed={visible}
          className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Toggle className="size-4" />
        </button>
      }
    />
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
    >
      {message}
    </div>
  );
}
