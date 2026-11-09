"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";

export const SIGNUPS_PAGE = "/cases/inscriptions";

// Haut de l'arbre des dossiers : les demandes reçues sur la page
// d'inscription en ligne, avec leur nombre (mis en avant s'il y en a), ou
// « Fermée » tant que la page n'accueille pas de candidats : le patron
// découvre ainsi la fonction là où il travaille.
export function SignupsTreeLink({ count, open }: { count: number; open: boolean }) {
  const active = usePathname() === SIGNUPS_PAGE;
  return (
    <Link
      href={SIGNUPS_PAGE}
      aria-current={active ? "page" : undefined}
      className={cn(
        "mx-2 mb-1 flex min-h-9 items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/60",
        active && "bg-accent text-accent-foreground hover:bg-accent",
      )}
    >
      <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate">Inscriptions en ligne</span>
      {count > 0 ? (
        <>
          <span
            aria-hidden
            className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground tabular-nums"
          >
            {count > 99 ? "99+" : count}
          </span>
          {/* Lu d'un seul tenant : « Inscriptions en ligne (2 demandes) » */}
          <span className="sr-only"> ({plural(count, "demande")})</span>
        </>
      ) : (
        !open && (
          <>
            <span aria-hidden className="shrink-0 text-xs text-muted-foreground">
              Fermée
            </span>
            <span className="sr-only"> (Fermée)</span>
          </>
        )
      )}
    </Link>
  );
}
