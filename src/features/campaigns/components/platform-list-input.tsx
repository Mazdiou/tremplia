"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { FieldError } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_SUGGESTED_PLATFORMS } from "../schemas";

// Plateformes proposées pour les comptes des candidats : une pastille par
// plateforme, ajoutée avec Entrée, le bouton ou en quittant le champ : une
// saisie oubliée avant « Enregistrer » n'est pas perdue (doublons ignorés,
// majuscules comprises). Réglages d'une campagne et valeurs par défaut de l'agence.
export function PlatformListInput({
  id,
  label = "Plateformes suggérées",
  value,
  onChange,
  onPendingChange,
  error,
}: {
  id: string;
  label?: string;
  value: string[];
  onChange: (platforms: string[]) => void;
  // Une saisie attend d'être ajoutée (le formulaire a donc un changement)
  onPendingChange?: (pending: boolean) => void;
  error?: string;
}) {
  const [input, setInput] = useState("");

  function changeInput(text: string) {
    setInput(text);
    onPendingChange?.(text.trim() !== "");
  }

  function add() {
    const name = input.trim();
    if (!name) return;
    const exists = value.some(
      (p) => p.toLocaleLowerCase("fr") === name.toLocaleLowerCase("fr"),
    );
    if (!exists) onChange([...value, name]);
    changeInput("");
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((p) => (
            <li
              key={p}
              className="flex items-center gap-1 rounded-full border bg-muted/50 py-0.5 pr-1 pl-3 text-sm"
            >
              {p}
              <button
                type="button"
                aria-label={`Retirer ${p}`}
                className="touch-target grid size-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onChange(value.filter((x) => x !== p))}
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {value.length < MAX_SUGGESTED_PLATFORMS && (
        <div className="flex max-w-sm gap-2">
          <Input
            id={id}
            placeholder="Ex. : Pastel, Parcoursup"
            value={input}
            maxLength={80}
            onChange={(e) => changeInput(e.target.value)}
            onBlur={add}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={add}>
            Ajouter
          </Button>
        </div>
      )}
      <FieldError message={error} />
    </div>
  );
}
