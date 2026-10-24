"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";
import { MENU_ITEM_CLASS } from "@/components/page-ui";
import { useDismiss } from "@/hooks/use-dismiss";
import { ThemeToggle } from "@/components/theme-toggle";
import { loadClient } from "@/lib/supabase/lazy-client";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";
import type { Permission } from "@/lib/permissions";
import { openSearchPalette } from "./search-palette";
import { forgetOtherPushDevices } from "@/features/notifications/push-client";

// Taille commune des boutons. Sur téléphone, ils se partagent la largeur de
// la barre (44 px de haut, assez larges pour le pouce).
const RAIL_BUTTON =
  "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted max-md:h-11 max-md:w-auto max-md:max-w-16 max-md:flex-1";

// Barre d'icônes : colonne à gauche sur ordinateur, barre en bas sur mobile.
export function AppRail({
  isOwner,
  permissions,
  initials,
  name,
  isPlatformAdmin = false,
  taskBadge,
}: {
  isOwner: boolean;
  // Permissions accordées par le patron (pages qu'elles ouvrent)
  permissions: Permission[];
  initials: string;
  // Prénom et nom, en tête du menu du compte
  name: string;
  isPlatformAdmin?: boolean;
  // Mes tâches en retard ou du jour (rouge s'il y a du retard)
  taskBadge: { count: number; overdue: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    // Déconnexion de toutes les sessions du compte : plus aucun appareil ne
    // reçoit ses notifications avant la reconnexion
    await forgetOtherPushDevices({ keepThisDevice: false });
    const supabase = await loadClient();
    await supabase.auth.signOut();
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
            // Nom lu par les lecteurs d'écran : le libellé, puis le chiffre de
            // la pastille et ce qu'il compte (« Tâches (2 en retard ou du jour) »)
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                RAIL_BUTTON,
                "relative",
                active && "bg-accent text-accent-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-5" strokeWidth={1.6} aria-hidden />
              <span className="sr-only">{label}</span>
              {badge && (
                <span
                  className={cn(
                    "absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] leading-none font-semibold tabular-nums max-md:right-[calc(50%-1.25rem)]",
                    // Mêmes couleurs dans les deux thèmes : chiffre lisible (4,5:1)
                    badge.overdue ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950",
                  )}
                >
                  <span className="sr-only"> (</span>
                  {badge.count > 99 ? "99+" : badge.count}
                  <span className="sr-only">
                    {badge.overdue ? " en retard ou du jour)" : " pour aujourd'hui)"}
                  </span>
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
        <Search className="size-5" strokeWidth={1.6} aria-hidden />
      </button>

      <div className="hidden flex-1 md:block" />
      <ThemeToggle className="size-10 rounded-xl text-muted-foreground max-md:hidden" />
      <AccountMenu initials={initials} name={name} onLogout={logout} />
      {/* Téléphone : « Se déconnecter » est dans les Réglages, la barre garde
          ainsi assez de place pour le pouce */}
    </nav>
  );
}

// Pastille du compte (ordinateur) : ouvre un petit menu (nom, déconnexion),
// au lieu de déconnecter dès le premier clic. Les Réglages restent dans la
// barre, comme sur téléphone.
function AccountMenu({
  initials,
  name,
  onLogout,
}: {
  initials: string;
  name: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, setOpen);
  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={name}
        className="grid size-8 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {initials}
        <span className="sr-only"> : mon compte</span>
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Mon compte"
          className="absolute bottom-0 left-full z-30 ml-3 w-56 rounded-xl border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <p className="truncate px-2.5 pt-1.5 pb-2 text-sm font-medium">{name}</p>
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className={cn(MENU_ITEM_CLASS, "flex items-center gap-2")}
          >
            <LogOut className="size-4 text-muted-foreground" aria-hidden />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
