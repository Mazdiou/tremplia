"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { suffix: "", label: "Informations", ownerOnly: false },
  { suffix: "/documents", label: "Documents", ownerOnly: false },
  { suffix: "/motivation-letter", label: "Lettre de motivation", ownerOnly: false },
  { suffix: "/programs", label: "Formations", ownerOnly: false },
  { suffix: "/notes", label: "Notes", ownerOnly: false },
  { suffix: "/history", label: "Historique", ownerOnly: true },
];

export function CaseTabs({ id, isOwner }: { id: string; isOwner: boolean }) {
  const pathname = usePathname();
  const base = `/cases/${id}`;

  return (
    // Défilement horizontal sur téléphone, sans barre de défilement visible
    <nav
      aria-label="Sections du dossier"
      className="mt-4 flex gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.filter((t) => isOwner || !t.ownerOnly).map((t) => {
        const href = base + t.suffix;
        const active =
          t.suffix === "" ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={t.suffix}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 border-b-2 py-2.5 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
