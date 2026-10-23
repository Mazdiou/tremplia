"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { UnreadBadge } from "@/features/messages/components/unread-badge";
import { forgetPushDevice } from "@/features/notifications/push-client";

// Libellé court sur téléphone : les trois onglets tiennent sur 320 px
const TABS = [
  { href: "/student", label: "Informations", short: "Infos" },
  { href: "/student/letter", label: "Lettre de motivation", short: "Lettre" },
  { href: "/student/programs", label: "Formations", short: "Formations" },
  { href: "/student/messages", label: "Messages", short: "Messages" },
];

export function StudentTabs({ unreadMessages }: { unreadMessages: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections de mon dossier"
      className="flex gap-3.5 overflow-x-auto [scrollbar-width:none] min-[360px]:gap-5 sm:gap-6 [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-sm whitespace-nowrap transition-colors",
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
        await forgetPushDevice("/api/student/push");
        await callApi("/api/student/logout");
        router.replace("/student/login");
        router.refresh();
      }}
    >
      <LogOut /> <span className="max-sm:hidden">Se déconnecter</span>
    </Button>
  );
}
