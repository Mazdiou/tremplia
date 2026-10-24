"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WIDGETS, arrangeRows, type LayoutItem, type WidgetDef, type WidgetId } from "../widgets";

// Widget prêt à afficher : son contenu (rendu par le serveur), ou rien s'il
// n'est pas lu (masqué) ou sans objet ici (note expliquant pourquoi)
export type WidgetEntry = { id: WidgetId; node: React.ReactNode | null; note?: string };

// Le mode « Personnaliser » (et le glisser-déposer) n'est chargé qu'à
// l'ouverture
const LayoutEditor = dynamic(() => import("./layout-editor").then((m) => m.LayoutEditor), {
  ssr: false,
  loading: () => (
    <p className="py-10 text-center text-sm text-muted-foreground" role="status">
      Chargement…
    </p>
  ),
});

const OPEN_EVENT = "tremplia:customize-dashboard";

// Bouton de l'en-tête du tableau de bord
export function CustomizeButton() {
  return (
    <Button variant="outline" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      <LayoutGrid aria-hidden />
      Personnaliser
    </Button>
  );
}

export function DashboardWidgets({
  layout,
  widgets,
  personal,
  fallback,
  isOwner,
}: {
  layout: LayoutItem[];
  // Tous les widgets que le membre a le droit de voir
  widgets: WidgetEntry[];
  personal: boolean;
  fallback: LayoutItem[];
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const open = () => setEditing(true);
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  if (editing) {
    return (
      <LayoutEditor
        layout={layout}
        widgets={widgets}
        personal={personal}
        fallback={fallback}
        isOwner={isOwner}
        onClose={() => setEditing(false)}
      />
    );
  }

  const byId = new Map(widgets.map((w) => [w.id, w]));
  const shown = arrangeRows(layout.filter((item) => byId.get(item.id)?.node));
  if (shown.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed px-5 py-10 text-center text-sm text-muted-foreground">
        Aucun widget affiché. « Personnaliser » permet d&apos;en ajouter.
      </p>
    );
  }
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      {shown.map((item) => (
        <div
          key={item.id}
          className={cn(
            "@container min-w-0",
            item.wide && "lg:col-span-2",
            (WIDGETS[item.id] as WidgetDef).desktopOnly && "max-md:hidden",
          )}
        >
          {byId.get(item.id)!.node}
        </div>
      ))}
    </div>
  );
}
