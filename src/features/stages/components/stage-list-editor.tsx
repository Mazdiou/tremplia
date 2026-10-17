"use client";

import { Plus, Trash2 } from "lucide-react";
import { FieldError } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_STAGES } from "../schemas";

// Liste ordonnée de noms d'étapes : étapes de départ d'une nouvelle campagne
// et valeurs par défaut de l'agence.
export function StageListEditor({
  idPrefix,
  value,
  onChange,
  errors,
}: {
  idPrefix: string;
  value: string[];
  onChange: (stages: string[]) => void;
  // Erreurs de la route : « stages » (la liste) ou « stages.2 » (une étape)
  errors: Record<string, string>;
}) {
  const error =
    errors.stages ?? Object.entries(errors).find(([k]) => k.startsWith("stages."))?.[1];

  return (
    <>
      {value.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Sans étape, les dossiers n&apos;affichent pas leur avancement.
        </p>
      )}
      {value.length > 0 && (
        <ol className="space-y-2">
          {value.map((s, i) => (
            <li key={i} className="flex max-w-md items-start gap-2">
              <span
                aria-hidden
                className="mt-2 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground tabular-nums"
              >
                {i + 1}
              </span>
              <Label htmlFor={`${idPrefix}-${i}`} className="sr-only">
                Étape {i + 1}
              </Label>
              <Input
                id={`${idPrefix}-${i}`}
                value={s}
                maxLength={60}
                placeholder="Nom de l'étape"
                aria-invalid={errors[`stages.${i}`] ? true : undefined}
                onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Retirer l'étape ${i + 1}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {value.length < MAX_STAGES && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, ""])}>
          <Plus /> Ajouter une étape
        </Button>
      )}
      <FieldError message={error} />
    </>
  );
}
