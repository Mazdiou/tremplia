"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import type { FolderItem } from "./documents-panel";

// Ce que l'en-tête du dossier est en train de faire
export type FolderMode = "view" | "rename" | "confirm";

export type FolderActions = {
  // Ajouter des PDF ou des photos dans ce dossier (null : « Sans dossier »)
  addFiles: (folderId: string | null) => void;
  startRename: (f: FolderItem) => void;
  rename: (f: FolderItem, value: string) => void;
  askDelete: (f: FolderItem) => void;
  remove: (f: FolderItem) => void;
  cancel: () => void;
};

// Une section de la page des documents : un dossier de rangement, ou
// « Sans dossier » (folder null). Zone de dépôt : voir dropProps du panneau.
export function FolderSection({
  folder,
  count,
  collapsed,
  onToggle,
  over,
  dropProps,
  mode,
  busy,
  isOwner,
  readOnly,
  actions,
  children,
}: {
  folder: FolderItem | null;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  // Un document ou des fichiers sont glissés au-dessus
  over: boolean;
  dropProps: React.HTMLAttributes<HTMLElement>;
  mode: FolderMode;
  busy: boolean;
  isOwner: boolean;
  // Abonnement expiré : ni ajout, ni renommage, ni suppression
  readOnly: boolean;
  actions: FolderActions;
  // Les documents de la section
  children: ReactNode;
}) {
  const title = folder?.name ?? "Sans dossier";
  return (
    <section
      aria-label={title}
      {...dropProps}
      className={cn("rounded-xl border transition-colors", over && "border-primary bg-accent/40")}
    >
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Déplier ${title}` : `Replier ${title}`}
          className="touch-target shrink-0 rounded text-muted-foreground hover:text-foreground"
        >
          {collapsed ? (
            <ChevronRight className="size-4" aria-hidden />
          ) : (
            <ChevronDown className="size-4" aria-hidden />
          )}
        </button>
        <Folder className="size-5 shrink-0 text-muted-foreground" aria-hidden />

        {folder && mode === "rename" ? (
          <input
            autoFocus
            defaultValue={folder.name}
            maxLength={80}
            aria-label="Nom du dossier"
            disabled={busy}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Escape") actions.cancel();
              if (e.key === "Enter") actions.rename(folder, e.currentTarget.value);
            }}
            onBlur={() => {
              if (!busy) actions.cancel();
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          <h2 className="min-w-0 flex-1 truncate text-sm font-medium">
            {title}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{count}</span>
          </h2>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {folder && mode === "confirm" ? (
            <>
              <span className="mr-1 text-xs">
                {count > 0
                  ? `Supprimer ce dossier ? Ses ${plural(count, "document")} iront dans « Sans dossier ».`
                  : "Supprimer ce dossier ?"}
              </span>
              <Button
                variant="destructive"
                size="xs"
                disabled={busy}
                onClick={() => actions.remove(folder)}
              >
                Supprimer
              </Button>
              <Button variant="ghost" size="xs" onClick={actions.cancel}>
                Annuler
              </Button>
            </>
          ) : readOnly ? null : (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => actions.addFiles(folder?.id ?? null)}
                aria-label={`Ajouter des documents dans ${title}`}
                title="Ajouter des PDF ou des photos dans ce dossier"
              >
                <Plus />
              </Button>
              {folder && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => actions.startRename(folder)}
                  aria-label={`Renommer le dossier ${folder.name}`}
                  title="Renommer le dossier"
                >
                  <Pencil />
                </Button>
              )}
              {folder && isOwner && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => actions.askDelete(folder)}
                  aria-label={`Supprimer le dossier ${folder.name}`}
                  title="Supprimer le dossier (patron)"
                >
                  <Trash2 />
                </Button>
              )}
            </>
          )}
        </div>
      </header>

      {!collapsed &&
        (count === 0 ? (
          <p className="border-t px-3 py-3 text-xs text-muted-foreground">
            {readOnly
              ? "Aucun document."
              : folder
                ? "Dossier vide : déposez des PDF ou des photos ici."
                : "Déposez ici un document pour le sortir de son dossier."}
          </p>
        ) : (
          <ul className="divide-y border-t">{children}</ul>
        ))}
    </section>
  );
}
