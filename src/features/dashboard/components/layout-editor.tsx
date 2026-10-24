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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const instructionsId = useId();
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
  // À l'ouverture, l'éditeur peut se trouver sous le guide de démarrage
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Sans animation : un clic pendant le défilement tomberait à côté
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, []);

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

  const hidden = widgets.filter((w) => !items.some((i) => i.id === w.id));
  const busy = saving || refreshing;

  async function save() {
    setSaving(true);
    setError(null);
    // Disposition de départ inchangée : on n'en garde pas de copie, pour
    // suivre ensuite celle que choisira le patron
    const keepNothing = usesFallback && sameLayout(items, start) && !forAgency;
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
    <section
      ref={sectionRef}
      aria-labelledby={`${instructionsId}-title`}
      className="scroll-mt-4 space-y-5"
    >
      <div className="rounded-2xl border bg-highlight/40 px-5 py-4">
        <h2 id={`${instructionsId}-title`} className="font-semibold">
          Personnaliser le tableau de bord
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Faites glisser un widget par sa poignée, ou utilisez les flèches. Au clavier :
          Espace pour saisir la poignée, les flèches pour déplacer, Espace pour déposer.
          Un widget en demi-largeur resté seul sur sa ligne prendra toute la largeur. Votre
          disposition ne change que pour vous.
        </p>
      </div>

      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
          Aucun widget affiché : ajoutez-en depuis la liste ci-dessous.
        </p>
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

      {hidden.length > 0 && (
        <div className="rounded-2xl border bg-card">
          <h3 className="border-b px-5 py-3.5 text-sm font-semibold">Widgets disponibles</h3>
          <ul className="divide-y">
            {hidden.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{WIDGETS[w.id].label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {WIDGETS[w.id].description}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => update([...items, { id: w.id, size: WIDGETS[w.id].defaultSize }])}
                  aria-label={`Ajouter ${WIDGETS[w.id].label}`}
                >
                  <Plus aria-hidden />
                  Ajouter
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        {isOwner && (
          <label className="mb-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={forAgency}
              onChange={(e) => setForAgency(e.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>
              Proposer cette disposition à toute l&apos;équipe
              <span className="block text-xs text-muted-foreground">
                Les membres qui n&apos;ont pas personnalisé leur tableau de bord la verront.
              </span>
            </span>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {error && (
            <p className="mr-auto text-sm font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button
            variant="ghost"
            className={cn(!error && "mr-auto", "-ml-2")}
            disabled={busy || (usesFallback && sameLayout(items, start))}
            onClick={() => {
              setItems(start);
              setUsesFallback(true);
              setError(null);
            }}
          >
            Disposition de départ
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" disabled={busy} onClick={onClose}>
              Annuler
            </Button>
            <Button disabled={busy} onClick={save}>
              {busy ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function EditableWidget({
  item,
  entry,
  first,
  last,
  onUp,
  onDown,
  onSize,
  onHide,
}: {
  item: LayoutItem;
  entry: WidgetEntry;
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
        "@container min-w-0 rounded-2xl border-2 border-dashed border-primary/30 bg-card",
        item.size === "full" && "lg:col-span-2",
        sortable.isDragging && "relative z-20 shadow-lg",
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
