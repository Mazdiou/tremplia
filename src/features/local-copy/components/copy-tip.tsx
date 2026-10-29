"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { MonitorDown, X } from "lucide-react";
import { useLocalCopy } from "./local-copy-provider";

// Onglet Documents : fait découvrir la copie sur l'ordinateur, au moment où
// l'on dépose des PDF. Seulement sur Chrome ou Edge, tant que la copie n'est
// pas réglée ; « Masquer » la retire pour de bon sur ce navigateur.

const HIDDEN_KEY = "tremplia-astuce-copie-masquee";
const CHANGE = "tremplia-astuce-copie";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isHidden() {
  try {
    return localStorage.getItem(HIDDEN_KEY) === "1";
  } catch {
    return false;
  }
}

function hide() {
  try {
    localStorage.setItem(HIDDEN_KEY, "1");
  } catch {
    // Stockage indisponible (navigation privée) : masquée jusqu'au rechargement
  }
  window.dispatchEvent(new Event(CHANGE));
}

export function CopyTip() {
  const copy = useLocalCopy();
  // Masquée au rendu serveur, pour ne jamais clignoter
  const hidden = useSyncExternalStore(subscribe, isHidden, () => true);
  if (hidden || !copy?.ready || !copy.supported || copy.config) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
      <MonitorDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <p className="min-w-0 flex-1">
        Gardez une copie de ces PDF sur votre ordinateur, prête à déposer sur les plateformes.{" "}
        <Link href="/settings#ordinateur" className="font-medium whitespace-nowrap text-link hover:underline">
          Activer la copie
        </Link>
      </p>
      <button
        type="button"
        onClick={hide}
        className="-my-1.5 -mr-2 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label="Masquer l'astuce"
        title="Masquer"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
