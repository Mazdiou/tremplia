"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiPrefs } from "@/lib/ui-prefs";

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
