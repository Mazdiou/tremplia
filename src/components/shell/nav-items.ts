import {
  CalendarRange,
  FolderOpen,
  LayoutGrid,
  ListTodo,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

// ownerOnly : patron seulement ; permission : patron, ou membre à qui il l'a
// accordée (page Équipe)
type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  ownerOnly: boolean;
  permission?: Permission;
};

const ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: LayoutGrid, ownerOnly: false },
  { href: "/cases", label: "Dossiers", icon: FolderOpen, ownerOnly: false },
  { href: "/tasks", label: "Tâches", icon: ListTodo, ownerOnly: false },
  { href: "/payments", label: "Paiements", icon: Wallet, ownerOnly: false, permission: "payments_view" },
  { href: "/campaigns", label: "Campagnes", icon: CalendarRange, ownerOnly: false },
  { href: "/team", label: "Équipe", icon: Users, ownerOnly: true },
  { href: "/settings", label: "Réglages", icon: Settings, ownerOnly: false },
];

// Administration de la plateforme : visible de l'administrateur seulement
const ADMIN_ITEM: NavItem = { href: "/admin", label: "Administration", icon: ShieldCheck, ownerOnly: false };

// Pages principales accessibles à l'utilisateur (barre d'icônes, recherche)
export function navItems(
  isOwner: boolean,
  isPlatformAdmin: boolean,
  permissions: readonly Permission[],
) {
  return [...ITEMS, ...(isPlatformAdmin ? [ADMIN_ITEM] : [])].filter(
    (i) =>
      isOwner || (!i.ownerOnly && (!i.permission || permissions.includes(i.permission))),
  );
}
