"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import type { Permission } from "@/lib/permissions";
import { openSearchPalette } from "./search-palette";

// Taille commune des boutons. Sur téléphone, ils se partagent la largeur de
// la barre (44 px de haut, assez larges pour le pouce).
const RAIL_BUTTON =
  "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted max-md:h-11 max-md:w-auto max-md:max-w-16 max-md:flex-1";

// Barre d'icônes : colonne à gauche sur ordinateur, barre en bas sur mobile.
export function AppRail({
  isOwner,
  permissions,
  initials,
  isPlatformAdmin = false,
  taskBadge,
}: {
  isOwner: boolean;
  // Permissions accordées par le patron (pages qu'elles ouvrent)
  permissions: Permission[];
  initials: string;
  isPlatformAdmin?: boolean;
  // Mes tâches en retard ou du jour (rouge s'il y a du retard)
  taskBadge: { count: number; overdue: boolean };
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
      {navItems(isOwner, isPlatformAdmin, permissions).map(
        ({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const badge = href === "/tasks" && taskBadge.count > 0 ? taskBadge : null;
          return (
            <Link
              key={href}
              href={href}
              aria-label={
                badge
                  ? `${label} (${badge.count} ${badge.overdue ? "en retard ou du jour" : "pour aujourd'hui"})`
                  : label
              }
              title={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                RAIL_BUTTON,
                "relative",
                active && "bg-accent text-accent-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-5" strokeWidth={1.6} />
              {badge && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums max-md:right-[calc(50%-1.25rem)]",
                    // Mêmes couleurs dans les deux thèmes : chiffre lisible (4,5:1)
                    badge.overdue ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950",
                  )}
                >
                  {badge.count > 99 ? "99+" : badge.count}
                </span>
              )}
            </Link>
          );
        },
      )}

      {/* Recherche et thème : sur ordinateur seulement. Sur téléphone, le
          thème se change dans les Réglages. */}
      <button
        type="button"
        onClick={openSearchPalette}
        aria-label="Rechercher"
        title="Rechercher (Ctrl+K)"
        className={cn(RAIL_BUTTON, "max-md:hidden")}
      >
        <Search className="size-5" strokeWidth={1.6} />
      </button>

      <div className="hidden flex-1 md:block" />
      <ThemeToggle className="size-10 rounded-xl text-muted-foreground max-md:hidden" />
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
      {/* Téléphone : « Se déconnecter » est dans les Réglages, la barre garde
          ainsi assez de place pour le pouce */}
    </nav>
  );
}
