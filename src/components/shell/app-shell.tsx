import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { AppRail } from "./app-rail";

// Coquille commune : barre d'icônes + contenu. Utilisée par le tableau de
// bord, les campagnes et l'équipe ; la section dossiers ajoute son arbre.
export async function getShellUser() {
  const member = await requireMember();
  if (!member) redirect("/login");
  return {
    member,
    initials:
      `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase() || "?",
  };
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { member, initials } = await getShellUser();
  return (
    <div className="flex h-dvh flex-col-reverse overflow-hidden md:flex-row">
      <AppRail isOwner={member.isOwner} initials={initials} />
      <main className="relative min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
