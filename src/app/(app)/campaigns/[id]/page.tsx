import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FormSection,
  KeyRow,
  NewCaseLink,
  PageContainer,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "@/components/page-ui";
import { CAMPAIGN_STATUS_LABELS, type CampaignStatus } from "@/features/campaigns/labels";
import { CampaignDangerZone } from "@/features/campaigns/components/campaign-danger-zone";
import { CampaignSettingsForm } from "@/features/campaigns/components/campaign-settings-form";
import { GroupsManager } from "@/features/campaigns/components/groups-manager";
import { CampaignStages } from "@/features/stages/components/campaign-stages";
import { ExportCampaignButton } from "@/features/export/components/export-campaign-button";
import { countdownLabel, timeline } from "@/features/campaigns/timeline";
import { requireMember } from "@/lib/auth/require-member";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { formatLongDate, todayInAppTimezone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { countCases } from "@/features/cases/case-stats";
import { listCaseStats } from "@/features/cases/server/case-stats";
import { can } from "@/lib/permissions";
import { amountInputValue, formatDA } from "@/lib/money";
import { readAll } from "@/lib/supabase/read-all";
import { reportError } from "@/lib/report-error";
import { cn } from "@/lib/utils";
import { isUuid } from "@/lib/validation";
import { campaignName } from "@/features/campaigns/server/queries";
import type { Metadata } from "next";

// Titre de l'onglet : le nom de la campagne
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: (isUuid(id) && (await campaignName(id))) || "Campagne introuvable" };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [member, supabase] = await Promise.all([requireMember(), createClient()]);

  // Toutes les lectures partent ensemble ; via le RLS, une campagne d'une
  // autre agence est introuvable et ses lignes ne reviennent pas.
  const [
    { data: campaign },
    datesRes,
    infosRes,
    groupsRes,
    caseGroups,
    stats,
    stagesRes,
    stageStatsRes,
    readOnly,
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, status, suggested_platforms, default_fee")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("campaign_dates").select("label, date").eq("campaign_id", id),
    supabase.from("campaign_infos").select("label, value").eq("campaign_id", id).order("position"),
    supabase.from("campaign_groups").select("id, name").eq("campaign_id", id).order("position"),
    // Classement des dossiers actifs : lu en entier (plus de 1000 lignes
    // possibles), compté par groupe plus bas
    readAll<{ group_id: string }>((from, to) =>
      supabase
        .from("case_groups")
        .select("group_id, cases!inner(status)")
        .eq("campaign_id", id)
        .eq("cases.status", "active")
        .order("case_id")
        .order("group_id")
        .range(from, to),
    ).catch(() => {
      reportError("[campaign page] groupes", "lecture impossible");
      return [];
    }),
    // Dossiers de la campagne, tous et actifs : une lecture (vue case_stats)
    listCaseStats([id]),
    supabase.from("campaign_stages").select("id, name").eq("campaign_id", id).order("position"),
    supabase.from("case_stage_stats").select("stage_id, status, cases").eq("campaign_id", id),
    // Abonnement expiré : consultation seulement
    member ? isReadOnly(member.agencyId) : false,
  ]);
  if (!campaign) notFound();

  const totalCount = countCases(stats);
  const activeCount = countCases(stats, { status: "active" });
  const status = campaign.status as CampaignStatus;
  const archived = status === "archived";
  const dates = (datesRes.data ?? []) as { label: string; date: string }[];
  const infos = (infosRes.data ?? []) as { label: string; value: string }[];
  const activeByGroup = new Map<string, number>();
  for (const { group_id: g } of caseGroups) {
    activeByGroup.set(g, (activeByGroup.get(g) ?? 0) + 1);
  }
  const groups = ((groupsRes.data ?? []) as { id: string; name: string }[]).map((g) => ({
    ...g,
    activeCases: activeByGroup.get(g.id) ?? 0,
  }));
  const stageCounts = new Map<string, { active: number; all: number }>();
  for (const row of (stageStatsRes.data ?? []) as {
    stage_id: string | null;
    status: string;
    cases: number;
  }[]) {
    if (!row.stage_id) continue;
    const c = stageCounts.get(row.stage_id) ?? { active: 0, all: 0 };
    c.all += row.cases;
    if (row.status === "active") c.active += row.cases;
    stageCounts.set(row.stage_id, c);
  }
  const stages = ((stagesRes.data ?? []) as { id: string; name: string }[]).map((st) => ({
    ...st,
    activeCases: stageCounts.get(st.id)?.active ?? 0,
    cases: stageCounts.get(st.id)?.all ?? 0,
  }));
  const items = timeline(
    dates.map((d) => ({ ...d, campaignId: id, campaignName: campaign.name as string })),
    todayInAppTimezone(),
  );
  const next = items.find((d) => d.days >= 0) ?? null;
  // Patron, ou permission « Gérer les campagnes »
  const manages = member !== null && can(member, "campaigns_manage");
  const canEdit = manages && !archived && !readOnly;
  const platforms = (campaign.suggested_platforms ?? []) as string[];
  const defaultFee = (campaign.default_fee as number | null) ?? null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Link href="/campaigns" className="hover:text-foreground">
            Campagnes
          </Link>
        }
        title={campaign.name as string}
        subtitle={
          <StatusPill tone={archived ? "off" : "ok"}>{CAMPAIGN_STATUS_LABELS[status]}</StatusPill>
        }
        actions={
          <>
            {/* Export : aussi en archive et en lecture seule (simple lecture) */}
            {manages && <ExportCampaignButton campaignId={id} />}
            {/* Abonnement expiré : rien à créer (comme le tableau de bord) */}
            {!archived && !readOnly && <NewCaseLink campaignId={id} />}
          </>
        }
      />

      {archived && (
        <p className="rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Cette campagne est archivée. Ses dossiers restent modifiables.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Dossiers actifs" value={activeCount} />
        <StatCard label="Dossiers au total" value={totalCount} />
        <div className="col-span-2 rounded-2xl border bg-card px-5 py-4 sm:col-span-1">
          <p className="text-sm text-muted-foreground">Prochaine échéance</p>
          {next ? (
            <>
              <p className="mt-1 truncate font-semibold">{next.label}</p>
              <p className="text-sm text-muted-foreground">
                {formatLongDate(next.date)},{" "}
                <span className="font-medium text-link">{countdownLabel(next.days)}</span>
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Aucune à venir</p>
          )}
        </div>
      </div>

      {canEdit ? (
        <CampaignSettingsForm
          campaignId={id}
          initial={{
            name: campaign.name as string,
            dates: items.map(({ label, date }) => ({ label, date })),
            infos,
            suggestedPlatforms: platforms,
            defaultFee: amountInputValue(defaultFee),
          }}
        />
      ) : (
        <div className="grid items-start gap-5 md:grid-cols-2">
          <Panel title="Dates">
            {items.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Aucune date</p>
            ) : (
              <ul>
                {items.map((d) => (
                  <li
                    key={`${d.label}-${d.date}`}
                    className={cn(
                      "flex items-baseline justify-between gap-4 border-b px-5 py-3 text-sm last:border-b-0",
                      d.days < 0 && "text-muted-foreground",
                    )}
                  >
                    <span>{d.label}</span>
                    <span className="shrink-0 tabular-nums">
                      {formatLongDate(d.date)}{" "}
                      <span className="text-xs text-muted-foreground">({countdownLabel(d.days)})</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <div className="space-y-5">
            <Panel title="Informations">
              {infos.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">Aucune information</p>
              ) : (
                <dl>
                  {infos.map((i) => (
                    <KeyRow key={i.label} label={i.label} stacked>
                      {i.value}
                    </KeyRow>
                  ))}
                </dl>
              )}
            </Panel>
            <Panel title="Tarif par défaut">
              <p className="px-5 py-4 text-sm">
                {defaultFee === null ? (
                  <span className="text-muted-foreground">Aucun</span>
                ) : (
                  <span className="font-medium tabular-nums">{formatDA(defaultFee)}</span>
                )}
              </p>
            </Panel>
            <Panel title="Plateformes suggérées">
              <div className="flex flex-wrap gap-1.5 px-5 py-4">
                {platforms.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Aucune</span>
                ) : (
                  platforms.map((p) => (
                    <span key={p} className="rounded-full border bg-muted/50 px-3 py-0.5 text-sm">
                      {p}
                    </span>
                  ))
                )}
              </div>
            </Panel>
          </div>
        </div>
      )}

      <FormSection
        title="Étapes des dossiers"
        description={
          archived
            ? "Figées tant que la campagne est archivée."
            : "Le parcours d'un dossier et le nombre de dossiers actifs à chaque étape."
        }
      >
        <CampaignStages campaignId={id} stages={stages} canEdit={canEdit} />
      </FormSection>

      <FormSection
        title="Groupes"
        description={
          archived
            ? "Figés tant que la campagne est archivée."
            : "Pour ranger les dossiers de la campagne."
        }
      >
        <GroupsManager campaignId={id} groups={groups} readOnly={archived || readOnly} />
      </FormSection>

      {manages && !readOnly && (
        <FormSection
          title="Zone sensible"
          description="Archiver met la campagne en pause ; la supprimer est définitif."
        >
          <CampaignDangerZone
            campaignId={id}
            archived={archived}
            caseCount={totalCount}
          />
        </FormSection>
      )}
    </PageContainer>
  );
}
