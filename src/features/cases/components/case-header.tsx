"use client";

import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

// En-tête de la fiche d'un dossier, réductible à une ligne pour laisser de
// la place au contenu (beaucoup de documents, longue lettre…). Le choix est
// mémorisé et vaut pour tous les dossiers.

export function CaseHeaderToggle() {
  const [prefs, setPrefs] = useUiPrefs();
  const collapsed = prefs.caseHeaderCollapsed;
  const label = collapsed ? "Afficher l'en-tête du dossier" : "Réduire l'en-tête du dossier";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setPrefs({ caseHeaderCollapsed: !collapsed })}
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className="text-muted-foreground"
    >
      {collapsed ? <ChevronDown /> : <ChevronUp />}
    </Button>
  );
}

// `details` : en-tête complet ; `compact` : la ligne affichée une fois réduit
export function CaseHeaderDetails({
  compact,
  children,
}: {
  compact: React.ReactNode;
  children: React.ReactNode;
}) {
  const [prefs] = useUiPrefs();
  return prefs.caseHeaderCollapsed ? compact : children;
}

// Panneau de suivi sous l'identité : une ligne par sujet (étape, comptes
// externes, espace candidat), alignées sur la même grille : libellé à
// gauche, contenu, actions à droite.
export function TrackPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 divide-y overflow-hidden rounded-xl border bg-card text-sm">
      {children}
    </div>
  );
}

// Retrait des lignes secondaires d'une section, pour commencer sous son
// contenu (largeur du libellé + écarts)
export const TRACK_INDENT = "px-4 sm:pl-[11.75rem]";

export function TrackRow({
  icon: Icon,
  label,
  children,
  actions,
  summary = false,
}: {
  icon: LucideIcon;
  label: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  // Contenu qui ne fait que résumer les lignes suivantes : masqué sur
  // téléphone, où il prendrait une ligne de plus
  summary?: boolean;
}) {
  // Téléphone : libellé et actions en haut, contenu sur toute la largeur
  // dessous. Ordinateur : tout sur une ligne.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:flex sm:flex-wrap">
      <span className="col-start-1 row-start-1 flex min-h-6 items-center gap-2 whitespace-nowrap text-muted-foreground sm:w-40 sm:shrink-0">
        <Icon className="size-4 shrink-0" aria-hidden />
        {label}
      </span>
      <div
        className={cn(
          "col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 empty:hidden sm:flex-1",
          summary && "max-sm:hidden",
        )}
      >
        {children}
      </div>
      {actions && (
        <div className="col-start-2 row-start-1 flex flex-wrap items-center justify-end gap-1 sm:ml-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
