"use client";

import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

// En-tête de la fiche d'un dossier, réductible à une ligne pour laisser de
// la place au contenu (beaucoup de documents, longue lettre…). Le choix est
// mémorisé et vaut pour tous les dossiers. Tant qu'il n'est pas fait,
// l'en-tête est réduit sur téléphone (déplié, il remplirait l'écran) et
// complet sur ordinateur.

// `collapsed` : l'en-tête où se trouve le bouton est la version réduite
export function CaseHeaderToggle({ collapsed }: { collapsed: boolean }) {
  const [, setPrefs] = useUiPrefs();
  const label = collapsed ? "Afficher l'en-tête du dossier" : "Réduire l'en-tête du dossier";
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setPrefs({ caseHeader: collapsed ? "expanded" : "collapsed" })}
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
  if (prefs.caseHeader === "collapsed") return compact;
  if (prefs.caseHeader === "expanded") return children;
  // Pas de choix : la largeur décide, en CSS (rien ne saute à l'affichage)
  return (
    <>
      <div className="md:hidden">{compact}</div>
      <div className="max-md:hidden">{children}</div>
    </>
  );
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
  // dessous. Le libellé garde sa largeur ; faute de place, ce sont les
  // actions qui passent à la ligne. Ordinateur : tout sur une ligne.
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 sm:flex sm:flex-wrap">
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
