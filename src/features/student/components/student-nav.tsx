"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/student", label: "Informations" },
  { href: "/student/letter", label: "Lettre de motivation" },
  { href: "/student/programs", label: "Formations" },
];

export function StudentTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Sections de mon dossier"
      className="flex gap-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
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
        await callApi("/api/student/logout");
        router.replace("/student/login");
        router.refresh();
      }}
    >
      <LogOut /> <span className="max-sm:hidden">Se déconnecter</span>
    </Button>
  );
}
