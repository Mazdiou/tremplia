import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { toCaseDraft } from "@/features/cases/case-record";
import { getSignup, signupPageState } from "@/features/signup/server/agency";
import { SignupHint } from "@/features/signup/components/signup-hint";
import { shortDateFormat } from "@/lib/dates";
import { isUuid } from "@/lib/validation";
import { createClient } from "@/lib/supabase/server";
import { countCases } from "@/features/cases/case-stats";
import { listCaseStats } from "@/features/cases/server/case-stats";
import { requireMember } from "@/lib/auth/require-member";
import { listCampaigns, listGroups } from "@/features/campaigns/server/queries";
import { CaseForm, type FormCampaign } from "@/features/cases/components/case-form";
import type { SourceCampaign } from "@/features/cases/components/import-panel";
import { listUsedPlatforms } from "@/features/cases/server/lookups";
import { ReadOnlyNotice } from "@/features/subscription/components/read-only-notice";
import { isReadOnly } from "@/features/subscription/server/subscription";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouveau dossier" };

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; inscription?: string }>;
}) {
  const member = await requireMember();
  if (!member) redirect("/login");
  if (await isReadOnly(member.agencyId)) {
    return <ReadOnlyNotice backHref="/cases" backLabel="Retour aux dossiers" />;
  }

  // Demande d'inscription en ligne à accepter : déjà traitée (ou d'une autre
  // agence), on le dit plutôt que d'ouvrir un formulaire vide
  const { campaign: wanted, inscription } = await searchParams;
  const signup = inscription && isUuid(inscription) ? await getSignup(inscription) : null;
  if (inscription && !signup) {
    return (
      <PageContainer>
        <PageHeader
          eyebrow={
            <Link href="/cases/inscriptions" className="hover:text-foreground">
              ← Inscriptions en ligne
            </Link>
          }
          title="Nouveau dossier"
        />
        <EmptyState
          icon={Globe}
          title="Demande déjà traitée"
          description="Un collègue a déjà créé le dossier ou refusé cette demande."
          action={
            <Link href="/cases/inscriptions" className={buttonVariants({ variant: "outline" })}>
              Voir les inscriptions en ligne
            </Link>
          }
        />
      </PageContainer>
    );
  }

  // Lecture via le RLS : seules les données de l'agence reviennent. Les
  // lectures indépendantes sont lancées ensemble.
  const supabase = await createClient();
  const [campaigns, stats, platformSuggestions, membersRes, signupPage] = await Promise.all([
    listCampaigns(),
    // Nombre de dossiers par campagne (campagnes d'où importer un candidat)
    listCaseStats(),
    // Plateformes déjà utilisées dans l'agence, en suggestion
    listUsedPlatforms(),
    // Seul le patron choisit un responsable : on ne charge la liste que pour lui
    member.isOwner
      ? supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .eq("is_active", true)
          .order("first_name")
      : Promise.resolve({ data: null }),
    // Encadré « inscription en ligne » : patron seulement, page fermée
    member.isOwner && !signup ? signupPageState(member.agencyId) : Promise.resolve(null),
  ]);
  const active = campaigns.filter((c) => c.status === "active");
  const activeIds = active.map((c) => c.id);
  const [groups, { data: settings }] = await Promise.all([
    listGroups(activeIds),
    supabase
      .from("campaigns")
      .select("id, suggested_platforms, default_fee")
      .in("id", activeIds),
  ]);
  const settingsByCampaign = new Map(
    (settings ?? []).map((s) => [
      s.id as string,
      {
        platforms: (s.suggested_platforms ?? []) as string[],
        defaultFee: (s.default_fee as number | null) ?? null,
      },
    ]),
  );

  const formCampaigns: FormCampaign[] = active.map((c) => ({
    id: c.id,
    name: c.name,
    groups: groups.filter((g) => g.campaign_id === c.id).map(({ id, name }) => ({ id, name })),
    suggestedPlatforms: settingsByCampaign.get(c.id)?.platforms ?? [],
    defaultFee: settingsByCampaign.get(c.id)?.defaultFee ?? null,
  }));

  // Présélection : la campagne choisie par le candidat (si elle reçoit
  // encore des dossiers), la campagne ouverte dans l'arbre, sinon l'unique
  // active
  const defaultCampaignId =
    active.find((c) => c.id === signup?.campaignId)?.id ??
    active.find((c) => c.id === wanted)?.id ??
    (active.length === 1 ? active[0].id : null);

  // Campagnes d'où importer un candidat (archivées comprises), avec leur
  // nombre de dossiers
  const sources: SourceCampaign[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    caseCount: countCases(stats, { campaignId: c.id }),
  }));

  const members = (membersRes.data ?? []) as { id: string; first_name: string; last_name: string }[];

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          signup ? (
            <Link href="/cases/inscriptions" className="hover:text-foreground">
              ← Inscriptions en ligne
            </Link>
          ) : (
            <Link href="/cases" className="hover:text-foreground">
              ← Dossiers
            </Link>
          )
        }
        title="Nouveau dossier"
      />
      {signupPage && !signupPage.open && active.length > 0 && <SignupHint />}
      <CaseForm
        // Une autre demande ouverte ensuite repart de zéro
        key={signup?.id ?? "new"}
        signup={
          signup && {
            id: signup.id,
            fields: toCaseDraft(signup.fields),
            message: signup.message,
            sentOn: shortDateFormat.format(new Date(signup.createdAt)),
          }
        }
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
