"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { UnreadBadge } from "@/features/messages/components/unread-badge";

const TABS = [
  { suffix: "", label: "Informations", ownerOnly: false },
  { suffix: "/documents", label: "Documents", ownerOnly: false },
  { suffix: "/programs", label: "Formations", ownerOnly: false },
  { suffix: "/motivation-letter", label: "Lettre de motivation", ownerOnly: false },
  { suffix: "/notes", label: "Notes", ownerOnly: false },
  { suffix: "/tasks", label: "Tâches", ownerOnly: false },
  { suffix: "/messages", label: "Messages", ownerOnly: false },
  { suffix: "/payments", label: "Paiements", ownerOnly: false },
  { suffix: "/history", label: "Historique", ownerOnly: true },
];

export function CaseTabs({
  id,
  isOwner,
  unreadMessages,
  documentsToCheck,
  openTasks,
}: {
  id: string;
  isOwner: boolean;
  // Messages du candidat non lus par l'agence
  unreadMessages: number;
  // Pièces envoyées par le candidat, pas encore acceptées
  documentsToCheck: number;
  // Tâches à faire du dossier
  openTasks: number;
}) {
  const pathname = usePathname();
  const base = `/cases/${id}`;
  const navRef = useRef<HTMLElement>(null);
  // D'autres onglets à gauche ou à droite (téléphone) : un fondu de ce côté
  // l'indique, la barre de défilement étant masquée
  const [more, setMore] = useState({ left: false, right: false });

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const update = () => {
      const left = nav.scrollLeft > 2;
      const right = nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2;
      setMore((m) => (m.left === left && m.right === right ? m : { left, right }));
    };
    // L'onglet ouvert reste visible
    nav.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
    update();
    nav.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      nav.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  return (
    // Défilement horizontal sur téléphone, sans barre de défilement visible
    <nav
      ref={navRef}
      aria-label="Sections du dossier"
      className={cn(
        "mt-4 flex gap-6 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        more.left && more.right
          ? "[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
          : more.right
            ? "[mask-image:linear-gradient(to_right,black_80%,transparent)]"
            : more.left && "[mask-image:linear-gradient(to_right,transparent,black_20%)]",
      )}
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
              "flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-sm whitespace-nowrap transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.suffix === "/messages" && unreadMessages > 0 && !active && (
              <UnreadBadge count={unreadMessages} />
            )}
            {t.suffix === "/documents" && documentsToCheck > 0 && (
              <UnreadBadge
                count={documentsToCheck}
                what={["pièce à vérifier", "pièces à vérifier"]}
              />
            )}
            {t.suffix === "/tasks" && openTasks > 0 && (
              <span className="rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                {openTasks}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
