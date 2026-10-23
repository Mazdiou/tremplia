import { redirect } from "next/navigation";
import { requireMember, type Member } from "@/lib/auth/require-member";
import { initialsOf } from "@/lib/names";
import { effectivePermissions } from "@/lib/permissions";
import { SubscriptionBanner } from "@/features/subscription/components/subscription-banner";
import { isPlatformAdmin } from "@/features/admin/server/admin";
import { LiveRefresh } from "@/components/live-refresh";
import { LocalCopyProvider } from "@/features/local-copy/components/local-copy-provider";
import { NewCaseShortcut } from "@/features/cases/components/new-case-shortcut";
import { myTaskCounts } from "@/features/tasks/server/read";
import { PushKeeper } from "@/features/notifications/components/push-keeper";
import { pushPublicKey } from "@/features/notifications/server/push";
import { AppRail } from "./app-rail";
import { SearchPalette } from "./search-palette";

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
export async function ShellFrame({
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
  // Pastille de « Tâches » : mes tâches en retard et du jour
  const tasks = await myTaskCounts(member.userId);
  const publicKey = pushPublicKey();
  return (
    // Copie des documents sur l'ordinateur : Réglages, fiche du candidat et
    // rattrapage à l'ouverture
    <LocalCopyProvider agencyId={member.agencyId} userId={member.userId}>
      <div className="flex h-dvh flex-col-reverse overflow-hidden md:flex-row">
        <LiveRefresh agencyId={member.agencyId} />
        <SearchPalette
          isOwner={member.isOwner}
          isPlatformAdmin={isPlatformAdmin}
          permissions={effectivePermissions(member)}
        />
        <NewCaseShortcut />
        {publicKey && (
          <PushKeeper publicKey={publicKey} deviceUrl="/api/push/device" owner={member.userId} />
        )}
        <AppRail
          isOwner={member.isOwner}
          permissions={effectivePermissions(member)}
          initials={initials}
          isPlatformAdmin={isPlatformAdmin}
          taskBadge={{ count: tasks.overdue + tasks.today, overdue: tasks.overdue > 0 }}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <SubscriptionBanner agencyId={member.agencyId} />
          {children}
        </div>
      </div>
    </LocalCopyProvider>
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
