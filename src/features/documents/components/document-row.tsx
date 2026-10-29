"use client";

import { Eye, FileText, FolderInput, GripVertical, Lock, LockOpen, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocItem, FolderItem } from "./documents-panel";

// Clé de la section « Sans catégorie » (et valeur correspondante du menu Déplacer)
export const NO_FOLDER = "none";
// Type propre au glisser-déposer d'un document de cette page
export const DOC_DRAG_TYPE = "application/x-tremplia-doc";

// Ce que la ligne est en train de faire : rien, renommer, choisir un dossier
// de destination, ou confirmer la suppression
export type DocRowMode = "view" | "rename" | "move" | "confirm";

export type DocRowActions = {
  open: (d: DocItem) => void;
  startRename: (d: DocItem) => void;
  rename: (d: DocItem, value: string) => void;
  startMove: (d: DocItem) => void;
  move: (d: DocItem, folderId: string | null) => void;
  askDelete: (d: DocItem) => void;
  remove: (d: DocItem) => void;
  toggleLock: (d: DocItem) => void;
  // Fin du renommage, du déplacement ou de la confirmation sans rien faire
  cancel: () => void;
  dragStart: (d: DocItem) => void;
  dragEnd: () => void;
};

const fieldClass =
  "h-8 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

export function DocumentRow({
  doc: d,
  folders,
  isOwner,
  readOnly,
  mode,
  busy,
  saving,
  dragging,
  actions,
}: {
  doc: DocItem;
  folders: FolderItem[];
  isOwner: boolean;
  // Abonnement expiré : le document s'ouvre, rien d'autre
  readOnly: boolean;
  mode: DocRowMode;
  // Action en cours sur ce document (suppression, verrou, déplacement)
  busy: boolean;
  // Renommage en cours d'enregistrement
  saving: boolean;
  dragging: boolean;
  actions: DocRowActions;
}) {
  const draggable = !readOnly && !d.locked && mode !== "rename" && mode !== "move";
  return (
    <li
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DOC_DRAG_TYPE, d.id);
        e.dataTransfer.effectAllowed = "move";
        actions.dragStart(d);
      }}
      onDragEnd={actions.dragEnd}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 text-sm @max-xl:flex-wrap",
        dragging && "opacity-50",
      )}
    >
      {draggable ? (
        <GripVertical
          className="-ml-1 size-4 shrink-0 cursor-grab text-muted-foreground"
          aria-hidden
        />
      ) : (
        <span className="-ml-1 size-4 shrink-0" aria-hidden />
      )}
      <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />

      {mode === "rename" ? (
        <input
          autoFocus
          defaultValue={d.name}
          maxLength={120}
          aria-label="Nom du document"
          disabled={saving}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Escape") actions.cancel();
            if (e.key === "Enter") actions.rename(d, e.currentTarget.value);
          }}
          onBlur={() => {
            if (!saving) actions.cancel();
          }}
          className={cn(fieldClass, "min-w-0 flex-1")}
        />
      ) : (
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2">
            <span className="truncate font-medium">{d.name}</span>
            {d.locked && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                <Lock className="size-3" aria-hidden /> Verrouillé
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            Ajouté par {d.uploadedBy} le {d.dateLabel} ({d.sizeLabel})
          </p>
        </div>
      )}

      {/* Peu de place : boutons sous le nom, qui garde toute la largeur */}
      <div className="flex shrink-0 items-center gap-1 @max-xl:-mt-1 @max-xl:w-full @max-xl:justify-end">
        {mode === "move" ? (
          <select
            autoFocus
            aria-label={`Déplacer ${d.name} vers`}
            defaultValue={d.folderId ?? NO_FOLDER}
            onChange={(e) => {
              const value = e.target.value;
              actions.move(d, value === NO_FOLDER ? null : value);
            }}
            onBlur={actions.cancel}
            onKeyDown={(e) => {
              if (e.key === "Escape") actions.cancel();
            }}
            className={cn(fieldClass, "max-w-48")}
          >
            <option value={NO_FOLDER}>Sans catégorie</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        ) : mode === "confirm" ? (
          <>
            <span className="mr-1 text-xs">Supprimer ce document ?</span>
            <Button
              variant="destructive"
              size="xs"
              disabled={busy}
              onClick={() => actions.remove(d)}
            >
              Supprimer
            </Button>
            <Button variant="ghost" size="xs" onClick={actions.cancel}>
              Annuler
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => actions.open(d)}
              aria-label={`Ouvrir ${d.name}`}
              title="Ouvrir dans un nouvel onglet"
            >
              <Eye />
            </Button>
            {!readOnly && folders.length > 0 && (
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={() => actions.startMove(d)}
                aria-label={`Déplacer ${d.name}`}
                title="Changer de catégorie"
              >
                <FolderInput />
              </Button>
            )}
            {!readOnly && (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => actions.startRename(d)}
                  aria-label={`Renommer ${d.name}`}
                  title="Renommer"
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => actions.askDelete(d)}
                  aria-label={`Supprimer ${d.name}`}
                  title="Supprimer"
                >
                  <Trash2 />
                </Button>
              </>
            )}
            {isOwner && !readOnly && (
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={busy}
                onClick={() => actions.toggleLock(d)}
                aria-label={d.locked ? `Déverrouiller ${d.name}` : `Verrouiller ${d.name}`}
                title={d.locked ? "Déverrouiller" : "Verrouiller"}
              >
                {d.locked ? <LockOpen /> : <Lock />}
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}
