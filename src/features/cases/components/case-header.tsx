"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDismiss } from "@/hooks/use-dismiss";
import { useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

// En-tête de la fiche d'un dossier, réductible à une ligne pour laisser de
// la place au contenu (beaucoup de documents, longue lettre…). Le choix est
// mémorisé et vaut pour tous les dossiers. Tant qu'il n'est pas fait,
// l'en-tête est réduit sur téléphone (déplié, il remplirait l'écran) et
// complet sur ordinateur.

// Lien qui mène à une ligne de l'en-tête (guide de démarrage) :
// /cases/…?ouvrir=espace-candidat. L'en-tête s'affiche alors en entier.
const HEADER_TARGETS = ["espace-candidat"];
export function useHeaderTarget(): string | null {
  const target = useSearchParams().get("ouvrir");
  return target && HEADER_TARGETS.includes(target) ? target : null;
}

// `collapsed` : l'en-tête où se trouve le bouton est la version réduite
export function CaseHeaderToggle({ collapsed }: { collapsed: boolean }) {
  const [, setPrefs] = useUiPrefs();
  const router = useRouter();
  const pathname = usePathname();
  const target = useHeaderTarget();
  const label = collapsed ? "Afficher l'en-tête du dossier" : "Réduire l'en-tête du dossier";
  return (
    <Button
      variant="ghost"
      size={collapsed ? "icon-sm" : "icon"}
      onClick={() => {
        setPrefs({ caseHeader: collapsed ? "expanded" : "collapsed" });
        // Arrivé par un lien du guide : l'en-tête suit de nouveau le choix
        if (target) router.replace(pathname, { scroll: false });
      }}
      aria-expanded={!collapsed}
      aria-label={label}
      title={label}
      className={cn("text-muted-foreground", collapsed && "touch-target")}
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
  const target = useHeaderTarget();
  if (target) return children;
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
// gauche, contenu, actions à droite. Pas de overflow-hidden : les menus des
// lignes en dépassent ; ce sont les lignes extrêmes qui suivent les coins.
export function TrackPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 divide-y rounded-xl border bg-band-panel text-sm [&>:first-child]:rounded-t-xl [&>:last-child]:rounded-b-xl">
      {children}
    </div>
  );
}

// Retrait des lignes secondaires d'une section, pour commencer sous son
// contenu (largeur du libellé + écarts)
export const TRACK_INDENT = "px-4 @xl:pl-[10.75rem]";

export function TrackRow({
  icon: Icon,
  label,
  children,
  actions,
  multiline = false,
}: {
  icon: LucideIcon;
  label: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  // Contenu sur plusieurs lignes (un compte par ligne) : le libellé reste
  // en face de la première
  multiline?: boolean;
}) {
  // Peu de place (téléphone, ou à côté d'un arbre large) : libellé et
  // actions en haut, contenu sur toute la largeur dessous. Le libellé garde
  // sa largeur ; faute de place, ce sont les actions qui passent à la ligne.
  // Sinon : tout sur une ligne.
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 px-4 py-2.5 @xl:flex @xl:flex-wrap",
        multiline ? "items-start" : "items-center",
      )}
    >
      <span className="col-start-1 row-start-1 flex min-h-6 items-center gap-2 whitespace-nowrap text-muted-foreground @xl:w-36 @xl:shrink-0">
        <Icon className="size-4 shrink-0" aria-hidden />
        {label}
      </span>
      <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 empty:hidden @xl:flex-1">
        {children}
      </div>
      {actions && (
        <div className="col-start-2 row-start-1 flex flex-wrap items-center justify-end gap-1 @xl:ml-auto">
          {actions}
        </div>
      )}
    </div>
  );
}

// Menu déroulant d'une action de la ligne, ouvert sous son bouton, à droite
export function RowMenu({
  label,
  size,
  trigger,
  children,
}: {
  // Nom du bouton pour les lecteurs d'écran
  label: string;
  size: "xs" | "icon-xs";
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, setOpen);
  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size={size}
        // Bouton avec texte (« Partager ») : c'est son nom ; icône seule :
        // le libellé la nomme
        aria-label={size === "icon-xs" ? label : undefined}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger}
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute top-8 right-0 z-30 w-64 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
