"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { suffix: "", label: "Informations", ownerOnly: false },
  { suffix: "/documents", label: "Documents", ownerOnly: false },
  { suffix: "/notes", label: "Notes", ownerOnly: false },
  { suffix: "/formations", label: "Formations", ownerOnly: false },
  { suffix: "/historique", label: "Historique", ownerOnly: true },
];

export function CaseTabs({ id, isOwner }: { id: string; isOwner: boolean }) {
  const pathname = usePathname();
  const base = `/cases/${id}`;

  return (
    <nav aria-label="Sections du dossier" className="mt-4 flex gap-6 overflow-x-auto">
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
              "-mb-px border-b-2 py-2.5 text-sm transition-colors",
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
