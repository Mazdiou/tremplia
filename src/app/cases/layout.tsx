import { createClient } from "@/lib/supabase/server";
import { fetchCampaignCases } from "@/features/cases/fetch-campaign-cases";
import { AppRail } from "@/components/shell/app-rail";
import { getShellUser } from "@/components/shell/app-shell";
import { CasesContent } from "@/features/cases/components/cases-content";
import {
  CaseTree,
  type TreeCampaign,
  type TreeCase,
  type TreeMember,
} from "@/features/cases/components/case-tree";

export default async function CasesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { caller, isOwner, initials } = await getShellUser();

  // Lecture via le RLS : seuls les dossiers et membres de l'agence reviennent.
  const supabase = await createClient();
  // Supabase limite chaque requête à 1000 lignes : on charge la campagne en
  // cours par pages ; les autres campagnes sont chargées à l'ouverture.
  const [campaignsRes, membersRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, label, is_current")
      .order("label", { ascending: false }),
    supabase
      .from("profiles")
      .select("id, first_name, last_name, is_active")
      .order("first_name"),
  ]);

  if (campaignsRes.error) {
    console.error("[cases layout] campagnes", campaignsRes.error.message);
  }
  if (membersRes.error) {
    console.error("[cases layout] membres", membersRes.error.message);
  }

  const campaigns = (campaignsRes.data ?? []) as TreeCampaign[];
  const current = campaigns.find((c) => c.is_current);
  let cases: TreeCase[] = [];
  try {
    if (current) cases = await fetchCampaignCases(supabase, current.id);
  } catch (e) {
    console.error("[cases layout] dossiers", e instanceof Error ? e.name : "erreur");
  }

  return (
    <div className="flex h-dvh flex-col-reverse overflow-hidden md:flex-row">
      <AppRail isOwner={isOwner} initials={initials} />
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <CaseTree
          campaigns={campaigns}
          cases={cases}
          loadedCampaignIds={current ? [current.id] : []}
          members={(membersRes.data ?? []) as TreeMember[]}
          currentUserId={caller.user.id}
        />
        <CasesContent>{children}</CasesContent>
      </div>
    </div>
  );
}
