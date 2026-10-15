import { AppShell } from "@/components/shell/app-shell";

// Tableau de bord, campagnes et équipe partagent la même coquille : la barre
// d'icônes reste affichée d'une page à l'autre, seul le contenu se recharge.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
