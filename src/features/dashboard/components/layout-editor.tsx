"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Columns2,
  EyeOff,
  GripVertical,
  Plus,
  RectangleHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { WIDGETS, type LayoutItem, type WidgetDef, type WidgetId } from "../widgets";
import type { WidgetEntry } from "./dashboard-widgets";

const labelOf = (id: string | number) => WIDGETS[id as WidgetId]?.label ?? String(id);

// Lecteur d'écran : ce qui se passe pendant le glisser-déposer au clavier
const announcements: Announcements = {
  onDragStart: ({ active }) => `${labelOf(active.id)} saisi.`,
  onDragOver: ({ active, over }) =>
    over ? `${labelOf(active.id)} au-dessus de ${labelOf(over.id)}.` : undefined,
  onDragEnd: ({ active, over }) =>
    over
      ? `${labelOf(active.id)} déposé à la place de ${labelOf(over.id)}.`
      : `${labelOf(active.id)} déposé.`,
  onDragCancel: ({ active }) => `Déplacement de ${labelOf(active.id)} annulé.`,
};

const sameLayout = (a: LayoutItem[], b: LayoutItem[]) =>
  a.length === b.length && a.every((item, i) => item.id === b[i].id && item.size === b[i].size);

// Mode « Personnaliser » : l'ordre se change en faisant glisser la poignée
// (souris, doigt ou clavier) ou avec les flèches. Rien n'est enregistré
// avant « Enregistrer ».
export function LayoutEditor({
  layout,
  widgets,
  personal,
  fallback,
  isOwner,
  onClose,
}: {
  layout: LayoutItem[];
  widgets: WidgetEntry[];
  personal: boolean;
  fallback: LayoutItem[];
  isOwner: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const allowed = new Map(widgets.map((w) => [w.id, w]));
  // Disposition de départ, sans les widgets que le membre n'a pas le droit
  // de voir (sinon elle paraîtrait toujours modifiée)
  const start = fallback.filter((i) => allowed.has(i.id));
  const [items, setItems] = useState(() => layout.filter((i) => allowed.has(i.id)));
  // Sans disposition personnelle (ou remise à celle de départ) : rien à garder
  const [usesFallback, setUsesFallback] = useState(!personal);
  const [forAgency, setForAgency] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  // Widget tout juste ajouté : mis en évidence un instant
  const [added, setAdded] = useState<WidgetId | null>(null);
  // À l'ouverture, l'éditeur peut se trouver sous le guide de démarrage
  const sectionRef = useRef<HTMLElement>(null);
  // Sans animation : un clic pendant le défilement tomberait à côté
  const toTop = () => sectionRef.current?.scrollIntoView({ block: "start" });
  useEffect(() => {
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, []);
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(null), 2000);
    return () => clearTimeout(timer);
  }, [added]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const update = (next: LayoutItem[]) => {
    setItems(next);
    setUsesFallback(false);
    setError(null);
  };
  const move = (from: number, to: number) => update(arrayMove(items, from, to));
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(
      items.findIndex((i) => i.id === active.id),
      items.findIndex((i) => i.id === over.id),
    );
  };
  // Le widget ajouté arrive en tête, là où on le voit
  const add = (id: WidgetId) => {
    update([{ id, size: WIDGETS[id].defaultSize }, ...items]);
    setAdding(false);
    setAdded(id);
    toTop();
  };

  const hidden = widgets.filter((w) => !items.some((i) => i.id === w.id));
  const busy = saving || refreshing;
  const atStart = usesFallback && sameLayout(items, start);

  async function save() {
    setSaving(true);
    setError(null);
    // Disposition de départ inchangée : on n'en garde pas de copie, pour
    // suivre ensuite celle que choisira le patron
    const keepNothing = atStart && !forAgency;
    const res = await callApi("/api/dashboard/layout", {
      method: "PUT",
      body: { layout: keepNothing ? null : items, forAgency: isOwner && forAgency },
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    startTransition(() => {
      router.refresh();
      onClose();
    });
  }

  return (
    <section ref={sectionRef} aria-labelledby={titleId} className="scroll-mt-0 space-y-4">
      {/* Barre fixée en haut pendant tout le rangement */}
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 id={titleId} className="mr-auto font-semibold">
            Personnaliser
          </h2>
          <Button
            variant="outline"
            onClick={() => setAdding(true)}
            disabled={busy || hidden.length === 0}
            title={hidden.length === 0 ? "Tous les widgets sont déjà affichés" : undefined}
          >
            <Plus aria-hidden />
            Ajouter un widget
            {hidden.length > 0 && (
              <span className="rounded-full bg-accent px-1.5 text-xs text-accent-foreground tabular-nums">
                {hidden.length}
              </span>
            )}
          </Button>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button
              variant="ghost"
              className="-ml-2 mr-auto sm:ml-0"
              disabled={busy || atStart}
              onClick={() => {
                setItems(start);
                setUsesFallback(true);
                setError(null);
              }}
            >
              Disposition de départ
            </Button>
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Annuler
            </Button>
            <Button disabled={busy} onClick={save}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
        {(isOwner || error) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {isOwner && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={forAgency}
                  onChange={(e) => setForAgency(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Proposer aussi à toute l&apos;équipe
                <span className="text-xs text-muted-foreground max-sm:hidden">
                  (membres qui n&apos;ont pas personnalisé leur tableau de bord)
                </span>
              </label>
            )}
            {error && (
              <p className="text-sm font-medium text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Faites glisser un widget par sa poignée ou utilisez les flèches (au clavier : Espace
        pour saisir, flèches pour déplacer, Espace pour déposer). Un widget en demi-largeur
        resté seul sur sa ligne prendra toute la largeur. Votre disposition ne change que
        pour vous.
      </p>

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
          <p>Aucun widget affiché.</p>
          <Button variant="outline" className="mt-3" onClick={() => setAdding(true)}>
            <Plus aria-hidden />
            Ajouter un widget
          </Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Pour déplacer ce widget, appuyez sur Espace, puis sur les flèches. Espace pour le déposer, Échap pour annuler.",
          },
        }}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <ol className="grid items-start gap-5 lg:grid-cols-2">
            {items.map((item, index) => (
              <EditableWidget
                key={item.id}
                item={item}
                entry={allowed.get(item.id)!}
                highlight={added === item.id}
                first={index === 0}
                last={index === items.length - 1}
                onUp={() => move(index, index - 1)}
                onDown={() => move(index, index + 1)}
                onSize={() =>
                  update(
                    items.map((i) =>
                      i.id === item.id ? { ...i, size: i.size === "half" ? "full" : "half" } : i,
                    ),
                  )
                }
                onHide={() => update(items.filter((i) => i.id !== item.id))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <AddWidgetPanel
        open={adding}
        widgets={hidden}
        onAdd={add}
        onClose={() => setAdding(false)}
      />
    </section>
  );
}

// Widgets disponibles : panneau qui glisse de la droite sur ordinateur et
// monte du bas sur téléphone (<dialog> natif : focus gardé, Échap ferme)
function AddWidgetPanel({
  open,
  widgets,
  onAdd,
  onClose,
}: {
  open: boolean;
  widgets: WidgetEntry[];
  onAdd: (id: WidgetId) => void;
  onClose: () => void;
}) {
  const ref = useModalDialog(open);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border bg-card p-0 text-card-foreground backdrop:bg-black/45 md:mt-0 md:ml-auto md:h-dvh md:max-h-none md:w-[26rem] md:rounded-none md:rounded-l-2xl"
    >
      <div className="sticky top-0 flex items-center justify-between gap-3 border-b bg-card px-5 py-4">
        <h2 id={titleId} className="font-semibold">
          Ajouter un widget
        </h2>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer">
          <X aria-hidden />
        </Button>
      </div>
      {widgets.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Tous les widgets sont déjà affichés.
        </p>
      ) : (
        <ul className="space-y-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {widgets.map((w) => {
            const def = WIDGETS[w.id] as WidgetDef;
            const descriptionId = `${titleId}-${w.id}`;
            return (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onAdd(w.id)}
                  aria-label={`Ajouter ${def.label}`}
                  aria-describedby={descriptionId}
                  className="group flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-highlight/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium group-hover:text-link">
                      {def.label}
                    </span>
                    <span id={descriptionId} className="mt-0.5 block text-xs text-muted-foreground">
                      {def.description}
                    </span>
                    {w.note && (
                      <span className="mt-1 block text-xs text-muted-foreground italic">
                        {w.note}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Plus className="size-4" aria-hidden />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </dialog>
  );
}

function EditableWidget({
  item,
  entry,
  highlight,
  first,
  last,
  onUp,
  onDown,
  onSize,
  onHide,
}: {
  item: LayoutItem;
  entry: WidgetEntry;
  highlight: boolean;
  first: boolean;
  last: boolean;
  onUp: () => void;
  onDown: () => void;
  onSize: () => void;
  onHide: () => void;
}) {
  const sortable = useSortable({
    id: item.id,
    attributes: { roleDescription: "widget déplaçable" },
  });
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } =
    sortable;
  const label = WIDGETS[item.id].label;
  const half = item.size === "half";
  const desktopOnly = (WIDGETS[item.id] as WidgetDef).desktopOnly;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "@container min-w-0 rounded-2xl border-2 border-dashed border-primary/30 bg-card transition-shadow",
        item.size === "full" && "lg:col-span-2",
        sortable.isDragging && "relative z-20 shadow-lg",
        // Tout juste ajouté
        highlight && "border-solid border-primary ring-4 ring-primary/20",
      )}
    >
      <div className="flex items-center gap-1 border-b px-2 py-1.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Déplacer ${label}`}
          className="touch-target flex size-9 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={first}
          onClick={onUp}
          aria-label={`Monter ${label}`}
        >
          <ArrowUp aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={last}
          onClick={onDown}
          aria-label={`Descendre ${label}`}
        >
          <ArrowDown aria-hidden />
        </Button>
        {/* Deux tailles, sur grand écran seulement : une colonne sur téléphone */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onSize}
          className="max-lg:hidden"
          aria-label={`${label} : passer en ${half ? "pleine largeur" : "demi-largeur"}`}
          title={half ? "Demi-largeur" : "Pleine largeur"}
        >
          {half ? <Columns2 aria-hidden /> : <RectangleHorizontal aria-hidden />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onHide}
          aria-label={`Masquer ${label}`}
          title="Masquer"
        >
          <EyeOff aria-hidden />
        </Button>
      </div>
      {desktopOnly && (
        <p className="px-5 py-6 text-sm text-muted-foreground md:hidden">
          Affiché seulement sur ordinateur.
        </p>
      )}
      {entry.node ? (
        // Aperçu du contenu, sans clic possible pendant le rangement
        <div
          inert
          className={cn(
            "relative max-h-64 overflow-hidden p-2 opacity-70 select-none",
            desktopOnly && "max-md:hidden",
          )}
        >
          {entry.node}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card" />
        </div>
      ) : (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          {entry.note ?? "Son contenu apparaîtra après l'enregistrement."}
        </p>
      )}
    </li>
  );
}
