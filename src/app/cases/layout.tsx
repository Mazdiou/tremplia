import { createClient } from "@/lib/supabase/server";
import { AppRail } from "@/components/shell/app-rail";
import { getShellUser } from "@/components/shell/app-shell";
import {
  fetchCampaignCases,
  type CampaignCases,
} from "@/features/cases/fetch-campaign-cases";
import { listAgencyGroups, listCampaigns } from "@/features/campaigns/server/queries";
import { listAgencyStages } from "@/features/stages/server/stages";
import { CasesContent } from "@/features/cases/components/cases-content";
import { CaseTree, type TreeMember } from "@/features/cases/components/case-tree";
import { agencyUnreadCounts } from "@/features/messages/server/messages";
import { SubscriptionBanner } from "@/features/subscription/components/subscription-banner";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { isPlatformAdmin } from "@/features/admin/server/admin";

export default async function CasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Lecture via le RLS : seules les campagnes, groupes, dossiers et membres
  // de l'agence reviennent. Ces lectures partent tout de suite, sans attendre
  // l'utilisateur ; celles qui ont besoin de son agence suivent.
  const supabase = await createClient();
  const shared = Promise.all([
    listCampaigns(),
    listAgencyGroups(),
    listAgencyStages(),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, is_active")
      .order("first_name"),
  ]);
  const { member, initials } = await getShellUser();
  const [[campaigns, groups, stages, membersRes], unread, readOnly, admin] = await Promise.all([
    shared,
    agencyUnreadCounts(member.agencyId),
    isReadOnly(member.agencyId),
    isPlatformAdmin(member.userId),
  ]);
  if (membersRes.error) console.error("[cases layout] membres", membersRes.error.code);

  // Une seule campagne active : elle est ouverte d'emblée, ses dossiers sont
  // chargés ici. Les autres le sont à l'ouverture, par le navigateur.
  const active = campaigns.filter((c) => c.status === "active");
  const initialData: Record<string, CampaignCases> = {};
  if (active.length === 1) {
    try {
      initialData[active[0].id] = await fetchCampaignCases(supabase, active[0].id);
    } catch (e) {
      console.error("[cases layout] dossiers", e instanceof Error ? e.name : "erreur");
    }
  }

  return (
    <div className="flex h-dvh flex-col-reverse overflow-hidden md:flex-row">
      <AppRail isOwner={member.isOwner} initials={initials} isPlatformAdmin={admin} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <SubscriptionBanner agencyId={member.agencyId} />
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <CaseTree
            campaigns={campaigns}
            groups={groups}
            stages={stages}
            initialData={initialData}
            members={(membersRes.data ?? []) as TreeMember[]}
            currentUserId={member.userId}
            unread={unread}
            readOnly={readOnly}
          />
          <CasesContent>{children}</CasesContent>
        </div>
      </div>
    </div>
  );
}
