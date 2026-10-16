import { redirect } from "next/navigation";
import { requireMember, type Member } from "@/lib/auth/require-member";
import { initialsOf } from "@/lib/names";
import { SubscriptionBanner } from "@/features/subscription/components/subscription-banner";
import { isPlatformAdmin } from "@/features/admin/server/admin";
import { LiveRefresh } from "@/components/live-refresh";
import { AppRail } from "./app-rail";

export async function getShellUser() {
  const member = await requireMember();
  if (!member) redirect("/login");
  return {
    member,
    initials: initialsOf(member.firstName, member.lastName),
  };
}

// Coquille commune : barre d'icônes, bandeau d'abonnement, puis le contenu.
// Le tableau de bord, les campagnes et l'équipe y posent leur page
// (AppShell) ; la section dossiers y ajoute son arbre.
export function ShellFrame({
  member,
  initials,
  isPlatformAdmin,
  children,
}: {
  member: Member;
  initials: string;
  isPlatformAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh flex-col-reverse overflow-hidden md:flex-row">
      <LiveRefresh agencyId={member.agencyId} />
      <AppRail isOwner={member.isOwner} initials={initials} isPlatformAdmin={isPlatformAdmin} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SubscriptionBanner agencyId={member.agencyId} />
        {children}
      </div>
    </div>
  );
}

export async function AppShell({ children }: { children: React.ReactNode }) {
  const { member, initials } = await getShellUser();
  const admin = await isPlatformAdmin(member.userId);
  return (
    <ShellFrame member={member} initials={initials} isPlatformAdmin={admin}>
      <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
    </ShellFrame>
  );
}
