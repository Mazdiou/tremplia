"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { UnreadBadge } from "@/features/messages/components/unread-badge";
import { pausePushDevice } from "@/features/notifications/push-client";
import { useTabOverflow } from "@/hooks/use-tab-overflow";

// Libellé court sur téléphone : les cinq onglets tiennent sur 320 px (sans
// pastille ; avec, la barre défile et un fondu l'indique). « Pièces »
// n'apparaît que si l'agence en a demandé.
const TABS = [
  { href: "/student", label: "Informations", short: "Infos" },
  { href: "/student/letter", label: "Lettre de motivation", short: "Lettre" },
  { href: "/student/programs", label: "Formations", short: "Formations" },
  { href: "/student/documents", label: "Pièces demandées", short: "Pièces" },
  { href: "/student/messages", label: "Messages", short: "Messages" },
];

export function StudentTabs({
  unreadMessages,
  pieces,
}: {
  unreadMessages: number;
  // Pièces demandées par l'agence (null : aucune) et celles encore à envoyer
  pieces: { toSend: number } | null;
}) {
  const pathname = usePathname();
  const { ref, fadeClass } = useTabOverflow<HTMLElement>(pathname);
  return (
    <nav
      ref={ref}
      aria-label="Sections de mon dossier"
      className={cn(
        "flex gap-3 overflow-x-auto text-[0.8125rem] [scrollbar-width:none] min-[360px]:gap-4 min-[360px]:text-sm sm:gap-6 [&::-webkit-scrollbar]:hidden",
        fadeClass,
      )}
    >
      {TABS.filter((t) => pieces || t.href !== "/student/documents").map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 whitespace-nowrap transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="max-sm:hidden">{t.label}</span>
            {t.href === "/student/messages" && unreadMessages > 0 && !active && (
              <UnreadBadge count={unreadMessages} />
            )}
            {t.href === "/student/documents" && pieces && pieces.toSend > 0 && !active && (
              <UnreadBadge count={pieces.toSend} what={["pièce à envoyer", "pièces à envoyer"]} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function StudentLogout() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await pausePushDevice("/api/student/push");
        await callApi("/api/student/logout");
        router.replace("/student/login");
        router.refresh();
      }}
    >
      <LogOut /> <span className="max-sm:hidden">Se déconnecter</span>
    </Button>
  );
}
