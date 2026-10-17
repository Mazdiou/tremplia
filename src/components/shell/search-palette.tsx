"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CornerDownLeft, FolderOpen, Search } from "lucide-react";
import { EDUCATION_LEVEL_LABELS, STATUS_SUFFIXES, labelOf } from "@/features/cases/labels";
import { searchStatusLabel, useCaseSearch } from "@/features/cases/use-case-search";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { displayName, normalizeName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

const OPEN_EVENT = "studyflow:open-search";

// Ouvre la recherche depuis un bouton (barre d'icônes)
export function openSearchPalette() {
  window.dispatchEvent(new Event(OPEN_EVENT));
}

// Recherche rapide, disponible sur toutes les pages de l'agence : un candidat
// (par nom ou téléphone) ou une page. Ctrl+K (Cmd+K sur Mac) l'ouvre, sauf
// dans la section Dossiers où le raccourci va déjà à la recherche de l'arbre.
export function SearchPalette({
  isOwner,
  isPlatformAdmin,
}: {
  isOwner: boolean;
  isPlatformAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const show = () => setOpen(true);
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      if (pathname === "/cases" || pathname.startsWith("/cases/")) return;
      e.preventDefault();
      setOpen(true);
    }
    window.addEventListener(OPEN_EVENT, show);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, show);
      window.removeEventListener("keydown", onKey);
    };
  }, [pathname]);

  // Monté à chaque ouverture : saisie et sélection repartent de zéro
  if (!open) return null;
  return (
    <PaletteDialog
      isOwner={isOwner}
      isPlatformAdmin={isPlatformAdmin}
      onClose={() => setOpen(false)}
    />
  );
}

type Entry = {
  key: string;
  href: string;
  label: string;
  // Campagne du dossier, ou rien pour une page
  detail?: string;
  suffix?: string;
  level?: string;
  muted?: boolean;
  icon?: typeof Search;
};

function PaletteDialog({
  isOwner,
  isPlatformAdmin,
  onClose,
}: {
  isOwner: boolean;
  isPlatformAdmin: boolean;
  onClose: () => void;
}) {
  const ref = useModalDialog(true);
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const search = useCaseSearch(query);

  const words = normalizeName(query).split(" ").filter(Boolean);
  const pages: Entry[] = navItems(isOwner, isPlatformAdmin)
    .filter((p) => words.every((w) => normalizeName(p.label).includes(w)))
    .map((p) => ({ key: p.href, href: p.href, label: p.label, icon: p.icon }));
  const cases: Entry[] = search.results.map((r) => ({
    key: r.id,
    href: `/cases/${r.id}`,
    label: displayName(r.firstName, r.lastName),
    detail: r.campaignName,
    suffix: STATUS_SUFFIXES[r.status],
    level: labelOf(EDUCATION_LEVEL_LABELS, r.educationLevel),
    muted: r.status !== "active",
  }));
  const entries = [...pages, ...cases];
  const current = Math.min(active, Math.max(entries.length - 1, 0));
  const optionId = (i: number) => `${listId}-${i}`;

  // L'élément choisi au clavier reste visible dans la liste
  useEffect(() => {
    document.getElementById(`${listId}-${current}`)?.scrollIntoView({ block: "nearest" });
  }, [current, listId]);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    onClose();
    router.push(entry.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (entries.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + entries.length) % entries.length);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      go(entries[current]);
    }
  }

  function renderEntry(entry: Entry, index: number) {
    const Icon = entry.icon;
    return (
      <li key={entry.key} role="presentation">
        <Link
          id={optionId(index)}
          href={entry.href}
          role="option"
          aria-selected={index === current}
          tabIndex={-1}
          onClick={onClose}
          onMouseMove={() => index !== current && setActive(index)}
          className={cn(
            "mx-2 flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
            index === current && "bg-accent text-accent-foreground",
            entry.muted && index !== current && "text-muted-foreground",
            // Résultats de la saisie précédente, en attendant les nouveaux
            !Icon && search.pending && "opacity-60",
          )}
        >
          {Icon ? (
            <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
          ) : (
            <FolderOpen className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-2">
              <span className="truncate">{entry.label}</span>
              {entry.suffix && <span className="shrink-0 text-xs">({entry.suffix})</span>}
            </span>
            {entry.detail && (
              <span className="truncate text-xs text-muted-foreground">{entry.detail}</span>
            )}
          </span>
          {entry.level && (
            <span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">
              {entry.level}
            </span>
          )}
          {index === current && (
            <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground max-md:hidden" />
          )}
        </Link>
      </li>
    );
  }

  return (
    <dialog
      ref={ref}
      aria-label="Recherche"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100%-2rem))] overflow-hidden rounded-2xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/45"
    >
      <div className="flex items-center gap-2 border-b px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          placeholder="Rechercher un candidat (nom ou téléphone) ou une page"
          aria-label="Rechercher un candidat ou une page"
          role="combobox"
          aria-expanded
          aria-controls={listId}
          aria-activedescendant={entries.length > 0 ? optionId(current) : undefined}
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="rounded-md border px-1.5 text-[11px] text-muted-foreground max-md:hidden">
          Échap
        </kbd>
      </div>

      <div className="max-h-[min(60vh,28rem)] overflow-y-auto py-2" aria-busy={search.pending}>
        <ul id={listId} role="listbox" aria-label="Résultats">
          {pages.length > 0 && (
            <li role="presentation" className="px-5 pt-1 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Pages
            </li>
          )}
          {pages.map((p, i) => renderEntry(p, i))}
          {!search.tooShort && (
            <li role="presentation" className="px-5 pt-3 pb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Dossiers
            </li>
          )}
          {cases.map((c, i) => renderEntry(c, pages.length + i))}
        </ul>
        <p role="status" className="px-5 py-1.5 text-xs text-muted-foreground">
          {search.tooShort
            ? "Saisissez au moins 2 caractères pour chercher un candidat."
            : searchStatusLabel(search)}
        </p>
      </div>

      <div className="flex gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground max-md:hidden">
        <span>↑ ↓ pour choisir</span>
        <span>Entrée pour ouvrir</span>
      </div>
    </dialog>
  );
}
