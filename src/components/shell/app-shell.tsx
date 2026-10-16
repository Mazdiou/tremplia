import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { initialsOf } from "@/lib/names";
import { SubscriptionBanner } from "@/features/subscription/components/subscription-banner";
import { isPlatformAdmin } from "@/features/admin/server/admin";
import { LiveRefresh } from "@/components/live-refresh";
import { AppRail } from "./app-rail";

// Coquille commune : barre d'icônes + contenu. Utilisée par le tableau de
// bord, les campagnes et l'équipe ; la section dossiers ajoute son arbre.
export async function getShellUser() {
  const member = await requireMember();
  if (!member) redirect("/login");
  return {
    member,
    initials: initialsOf(member.firstName, member.lastName),
  };
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { member, initials } = await getShellUser();
  const admin = await isPlatformAdmin(member.userId);
  return (
    <div className="flex h-dvh flex-col-reverse overflow-hidden md:flex-row">
      <LiveRefresh agencyId={member.agencyId} />
      <AppRail isOwner={member.isOwner} initials={initials} isPlatformAdmin={admin} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SubscriptionBanner agencyId={member.agencyId} />
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
