"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { MAX_PHOTOS_PER_PDF } from "@/features/documents/photo-pdf";

export type PhotoPage = { id: string; file: File; url: string };

// Photos en attente d'assemblage, avec leur aperçu (libéré quand la photo
// est retirée ou que la page est quittée)
export function usePhotoPages() {
  const [pages, setPages] = useState<PhotoPage[]>([]);
  const pagesRef = useRef(pages);
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);
  useEffect(() => () => pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  return {
    pages,
    // Renvoie le nombre de photos laissées de côté (limite atteinte)
    add(files: File[]) {
      const room = Math.max(0, MAX_PHOTOS_PER_PDF - pagesRef.current.length);
      const kept = files.slice(0, room).map((file) => ({
        id: crypto.randomUUID(),
        file,
        url: URL.createObjectURL(file),
      }));
      setPages((prev) => [...prev, ...kept]);
      return files.length - kept.length;
    },
    remove(id: string) {
      setPages((prev) => {
        const p = prev.find((x) => x.id === id);
        if (p) URL.revokeObjectURL(p.url);
        return prev.filter((x) => x.id !== id);
      });
    },
    move(id: string, delta: -1 | 1) {
      setPages((prev) => {
        const i = prev.findIndex((x) => x.id === id);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      });
    },
    clear() {
      pagesRef.current.forEach((p) => URL.revokeObjectURL(p.url));
      setPages([]);
    },
  };
}

export type ComposeMode = "single" | "each";

// Assemblage des photos avant l'envoi : ordre des pages, pages retirées,
// un seul PDF ou un PDF par photo, nom du document. Pour une pièce
// demandée au candidat (`piece`) : toujours un seul PDF, au nom de la pièce.
export function PhotoComposer({
  pages,
  folderName = null,
  piece,
  busy,
  progress,
  onAdd,
  onRemove,
  onMove,
  onCancel,
  onSubmit,
}: {
  pages: PhotoPage[];
  // Dossier de rangement qui recevra les documents (null : « Sans dossier »)
  folderName?: string | null;
  // Nom de la pièce que ces photos composent (espace du candidat)
  piece?: string;
  busy: boolean;
  // Étape en cours, affichée pendant la préparation et l'envoi
  progress: string | null;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
  onCancel: () => void;
  onSubmit: (mode: ComposeMode, name: string) => void;
}) {
  const [mode, setMode] = useState<ComposeMode>("single");
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const several = pages.length > 1;
  const effectiveMode = several && !piece ? mode : "single";
  const full = pages.length >= MAX_PHOTOS_PER_PDF;

  return (
    <section
      aria-label="Photos à transformer en PDF"
      className="space-y-3 rounded-xl border bg-muted/30 p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">
          {plural(pages.length, "photo", "photos")} à transformer en PDF
        </h2>
        <p className="text-xs text-muted-foreground">
          {piece
            ? `Une page par photo, dans l'ordre ci-dessous`
            : `Rangement : ${folderName ? `« ${folderName} »` : "sans dossier"}`}
        </p>
      </div>

      <ol className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
        {pages.map((p, i) => (
          <li key={p.id} className="overflow-hidden rounded-lg border bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:) */}
            <img
              src={p.url}
              alt={`Page ${i + 1} : ${p.file.name}`}
              className="aspect-[3/4] w-full bg-muted object-contain"
            />
            <div className="flex items-center justify-between gap-1 px-1 py-1">
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={busy || i === 0}
                onClick={() => onMove(p.id, -1)}
                aria-label={`Avancer la page ${i + 1}`}
                title="Avancer"
              >
                <ArrowLeft aria-hidden />
              </Button>
              <span className="text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={busy || i === pages.length - 1}
                onClick={() => onMove(p.id, 1)}
                aria-label={`Reculer la page ${i + 1}`}
                title="Reculer"
              >
                <ArrowRight aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={busy}
                onClick={() => onRemove(p.id)}
                aria-label={`Retirer la page ${i + 1}`}
                title="Retirer"
              >
                <X aria-hidden />
              </Button>
            </div>
          </li>
        ))}
        {!full && (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <ImagePlus className="size-5" aria-hidden />
              Ajouter des photos
            </button>
          </li>
        )}
      </ol>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />

      {several && !piece && (
        <fieldset className="flex flex-wrap gap-2" disabled={busy}>
          <legend className="sr-only">Nombre de documents</legend>
          {(
            [
              ["single", `Un seul PDF de ${pages.length} pages`],
              ["each", `Un PDF par photo (${pages.length} documents)`],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm",
                mode === value && "border-primary",
              )}
            >
              <input
                type="radio"
                name="photo-compose-mode"
                value={value}
                checked={mode === value}
                onChange={() => setMode(value)}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </fieldset>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(effectiveMode, name);
        }}
      >
        {piece ? (
          <p className="flex-1 basis-56 text-xs text-muted-foreground">
            Les photos deviennent un seul PDF «&nbsp;{piece}&nbsp;».
          </p>
        ) : effectiveMode === "single" ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            disabled={busy}
            placeholder="Nom du document, ex. : Passeport"
            aria-label="Nom du document"
            className="h-8 min-w-0 flex-1 basis-56 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          <p className="flex-1 basis-56 text-xs text-muted-foreground">
            Chaque document prend le nom de sa photo ; vous pourrez les renommer ensuite.
          </p>
        )}
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" size="sm" disabled={busy || pages.length === 0}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {piece ? "Envoyer" : effectiveMode === "single" ? "Créer le PDF" : "Créer les PDF"}
        </Button>
      </form>

      {progress && (
        <p className="text-xs text-muted-foreground" role="status">
          {progress}
        </p>
      )}
    </section>
  );
}
