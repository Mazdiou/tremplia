"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// Taille du texte sur téléphone : « Réduite » réduit toute l'interface d'un
// dixième (classe text-small sur <html>, voir globals.css). Retenue sur cet
// appareil, posée avant l'affichage par le script du layout.
const KEY = "sf:text";
const CLASS = "text-small";

const OPTIONS = [
  { small: true, label: "Réduite" },
  { small: false, label: "Normale" },
];

function setSmallText(small: boolean) {
  document.documentElement.classList.toggle(CLASS, small);
  try {
    if (small) localStorage.setItem(KEY, "small");
    else localStorage.removeItem(KEY);
  } catch {
    // Stockage indisponible : le choix vaut pour cette visite seulement
  }
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function TextSizeChoice() {
  // null au rendu serveur et à l'hydratation : aucune option cochée
  const small = useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains(CLASS),
    () => null,
  );

  return (
    <div role="radiogroup" aria-label="Taille du texte" className="inline-flex rounded-xl border bg-muted/50 p-1">
      {OPTIONS.map((o) => {
        const checked = small === o.small;
        return (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => setSmallText(o.small)}
            className={cn(
              "flex h-10 touch-manipulation items-center rounded-lg px-4 text-sm font-medium text-muted-foreground transition-colors",
              checked && "bg-background text-foreground shadow-sm",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
