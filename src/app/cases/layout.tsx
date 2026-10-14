import { createClient } from "@/lib/supabase/server";
import { AppRail } from "@/components/shell/app-rail";
import { getShellUser } from "@/components/shell/app-shell";
import {
  fetchCampaignCases,
  type CampaignCases,
} from "@/features/cases/fetch-campaign-cases";
import { listCampaigns, listGroups } from "@/features/campaigns/server/queries";
import { CasesContent } from "@/features/cases/components/cases-content";
import { CaseTree, type TreeMember } from "@/features/cases/components/case-tree";
import { agencyUnreadCounts } from "@/features/messages/server/messages";

export default async function CasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { member, initials } = await getShellUser();

  // Lecture via le RLS : seules les campagnes, groupes, dossiers et membres
  // de l'agence reviennent.
  const supabase = await createClient();
  const [campaigns, membersRes, unread] = await Promise.all([
    listCampaigns(),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, is_active")
      .order("first_name"),
    agencyUnreadCounts(member.agencyId),
  ]);
  if (membersRes.error) console.error("[cases layout] membres", membersRes.error.code);
  const groups = await listGroups(campaigns.map((c) => c.id));

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
      <AppRail isOwner={member.isOwner} initials={initials} />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <CaseTree
          campaigns={campaigns}
          groups={groups}
          initialData={initialData}
          members={(membersRes.data ?? []) as TreeMember[]}
          currentUserId={member.userId}
          unread={unread}
        />
        <CasesContent>{children}</CasesContent>
      </div>
    </div>
  );
}
