import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-ui";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/require-member";
import { listCampaigns, listGroups } from "@/features/campaigns/server/queries";
import { CaseForm, type FormCampaign } from "@/features/cases/components/case-form";
import type { SourceCampaign } from "@/features/cases/components/import-panel";
import { listUsedPlatforms } from "@/features/cases/server/lookups";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const member = await requireMember();
  if (!member) redirect("/login");

  // Lecture via le RLS : seules les données de l'agence reviennent
  const supabase = await createClient();
  const campaigns = await listCampaigns();
  const active = campaigns.filter((c) => c.status === "active");
  const groups = await listGroups(active.map((c) => c.id));

  const { data: settings } = await supabase
    .from("campaigns")
    .select("id, suggested_platforms")
    .in(
      "id",
      active.map((c) => c.id),
    );
  const platformsByCampaign = new Map(
    (settings ?? []).map((s) => [s.id as string, (s.suggested_platforms ?? []) as string[]]),
  );

  const formCampaigns: FormCampaign[] = active.map((c) => ({
    id: c.id,
    name: c.name,
    groups: groups.filter((g) => g.campaign_id === c.id).map(({ id, name }) => ({ id, name })),
    suggestedPlatforms: platformsByCampaign.get(c.id) ?? [],
  }));

  // Présélection : la campagne ouverte dans l'arbre, sinon l'unique active
  const wanted = (await searchParams).campaign;
  const defaultCampaignId =
    active.find((c) => c.id === wanted)?.id ?? (active.length === 1 ? active[0].id : null);

  // Campagnes d'où importer un candidat (archivées comprises), avec leur
  // nombre de dossiers
  const sources: SourceCampaign[] = await Promise.all(
    campaigns.map(async (c) => {
      const { count } = await supabase
        .from("cases")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", c.id);
      return { id: c.id, name: c.name, caseCount: count ?? 0 };
    }),
  );

  // Plateformes déjà utilisées dans l'agence, en suggestion
  const platformSuggestions = await listUsedPlatforms();

  // Seul le patron choisit un responsable : on ne charge la liste que pour lui
  let members: { id: string; first_name: string; last_name: string }[] = [];
  if (member.isOwner) {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("is_active", true)
      .order("first_name");
    members = data ?? [];
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Link href="/cases" className="hover:text-foreground">
            ← Dossiers
          </Link>
        }
        title="Nouveau dossier"
        subtitle="Les champs marqués d'un astérisque sont obligatoires."
      />
      <CaseForm
        mode="create"
        campaigns={formCampaigns}
        defaultCampaignId={defaultCampaignId}
        sources={sources.filter((s) => s.caseCount > 0)}
        platformSuggestions={platformSuggestions}
        members={members}
        isOwner={member.isOwner}
        currentUserId={member.userId}
      />
    </PageContainer>
  );
}
