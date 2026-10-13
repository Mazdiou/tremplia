"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarRange, FolderOpen, LayoutGrid, LogOut, Users } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutGrid, ownerOnly: false },
  { href: "/cases", label: "Dossiers", icon: FolderOpen, ownerOnly: false },
  { href: "/campaigns", label: "Campagnes", icon: CalendarRange, ownerOnly: false },
  { href: "/team", label: "Équipe", icon: Users, ownerOnly: true },
];

// Barre d'icônes : colonne à gauche sur ordinateur, barre en bas sur mobile.
export function AppRail({
  isOwner,
  initials,
}: {
  isOwner: boolean;
  initials: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav
      aria-label="Navigation principale"
      className="z-20 flex shrink-0 items-center justify-around border-t bg-background px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:w-14 md:flex-col md:justify-start md:gap-2 md:border-t-0 md:border-r md:px-0 md:py-4"
    >
      {ITEMS.filter((i) => isOwner || !i.ownerOnly).map(
        ({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted max-md:h-11 max-md:w-16",
                active && "bg-accent text-accent-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-5" strokeWidth={1.6} />
            </Link>
          );
        },
      )}

      <div className="hidden flex-1 md:block" />
      <ThemeToggle className="size-10 rounded-xl text-muted-foreground" />
      <button
        type="button"
        onClick={logout}
        aria-label="Se déconnecter"
        title="Se déconnecter"
        className="group relative hidden size-8 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground md:grid"
      >
        <span className="group-hover:hidden">{initials}</span>
        <LogOut className="hidden size-4 group-hover:block" />
      </button>
      {/* Téléphone : pas de survol, donc une icône explicite */}
      <button
        type="button"
        onClick={logout}
        aria-label="Se déconnecter"
        title="Se déconnecter"
        className="grid h-11 w-16 place-items-center rounded-xl text-muted-foreground hover:bg-muted md:hidden"
      >
        <LogOut className="size-5" strokeWidth={1.6} />
      </button>
    </nav>
  );
}
