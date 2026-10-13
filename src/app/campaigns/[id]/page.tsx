import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/components/shell/app-shell";
import { KeyRow, PageHeader, Panel, StatusPill } from "@/components/page-ui";
import { CAMPAIGN_STATUS_LABELS, type CampaignStatus } from "@/features/campaigns/labels";
import { CampaignDangerZone } from "@/features/campaigns/components/campaign-danger-zone";
import { CampaignSettingsForm } from "@/features/campaigns/components/campaign-settings-form";
import { GroupsManager } from "@/features/campaigns/components/groups-manager";
import { countdownLabel, timeline } from "@/features/campaigns/timeline";
import { requireMember } from "@/lib/auth/require-member";
import { formatLongDate, todayInAppTimezone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const member = await requireMember();

  // Lecture via le RLS : une campagne d'une autre agence est introuvable
  const supabase = await createClient();
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, name, status, suggested_platforms")
    .eq("id", id)
    .maybeSingle();
  if (!campaign) notFound();

  const [datesRes, infosRes, groupsRes, caseGroupsRes, casesRes] = await Promise.all([
    supabase.from("campaign_dates").select("label, date").eq("campaign_id", id),
    supabase.from("campaign_infos").select("label, value").eq("campaign_id", id).order("position"),
    supabase.from("campaign_groups").select("id, name").eq("campaign_id", id).order("position"),
    supabase.from("case_groups").select("group_id, cases!inner(status)").eq("campaign_id", id).eq("cases.status", "active"),
    supabase.from("cases").select("id", { count: "exact", head: true }).eq("campaign_id", id),
  ]);

  const status = campaign.status as CampaignStatus;
  const archived = status === "archived";
  const dates = (datesRes.data ?? []) as { label: string; date: string }[];
  const infos = (infosRes.data ?? []) as { label: string; value: string }[];
  const activeByGroup = new Map<string, number>();
  for (const cg of caseGroupsRes.data ?? []) {
    const g = cg.group_id as string;
    activeByGroup.set(g, (activeByGroup.get(g) ?? 0) + 1);
  }
  const groups = ((groupsRes.data ?? []) as { id: string; name: string }[]).map((g) => ({
    ...g,
    activeCases: activeByGroup.get(g.id) ?? 0,
  }));
  const items = timeline(
    dates.map((d) => ({ ...d, campaignId: id, campaignName: campaign.name as string })),
    todayInAppTimezone(),
  );
  const canEdit = member?.isOwner === true && !archived;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
        <PageHeader
          title={campaign.name as string}
          subtitle={
            <StatusPill tone={archived ? "off" : "ok"}>{CAMPAIGN_STATUS_LABELS[status]}</StatusPill>
          }
          actions={
            <div className="flex gap-3 text-sm">
              {!archived && (
                <Link href={`/cases/new?campaign=${id}`} className="underline">
                  Nouveau dossier
                </Link>
              )}
              <Link href="/campaigns" className="underline">
                Toutes les campagnes
              </Link>
            </div>
          }
        />

        {archived && (
          <p className="rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            Campagne archivée : elle ne reçoit plus de dossier et ses réglages
            sont figés. Ses dossiers restent consultables et modifiables.
          </p>
        )}

        {canEdit ? (
          <Panel title="Réglages">
            <div className="p-5">
              <CampaignSettingsForm
                campaignId={id}
                initial={{
                  name: campaign.name as string,
                  dates: items.map(({ label, date }) => ({ label, date })),
                  infos,
                  suggestedPlatforms: (campaign.suggested_platforms ?? []) as string[],
                }}
              />
            </div>
          </Panel>
        ) : (
          <>
            <Panel title="Dates">
              {items.length === 0 ? (
                <p className="px-[18px] py-4 text-sm text-muted-foreground">Aucune date.</p>
              ) : (
                <dl>
                  {items.map((d) => (
                    <KeyRow key={`${d.label}-${d.date}`} label={d.label}>
                      {formatLongDate(d.date)}{" "}
                      <span className="text-xs text-muted-foreground">({countdownLabel(d.days)})</span>
                    </KeyRow>
                  ))}
                </dl>
              )}
            </Panel>
            {infos.length > 0 && (
              <Panel title="Informations">
                <dl>
                  {infos.map((i) => (
                    <KeyRow key={i.label} label={i.label}>
                      {i.value}
                    </KeyRow>
                  ))}
                </dl>
              </Panel>
            )}
            <Panel title="Plateformes suggérées">
              <p className="px-[18px] py-3 text-sm">
                {((campaign.suggested_platforms ?? []) as string[]).join(", ") || "Aucune"}
              </p>
            </Panel>
          </>
        )}

        <Panel title="Groupes">
          <div className="p-5">
            <GroupsManager campaignId={id} groups={groups} readOnly={archived} />
          </div>
        </Panel>

        {member?.isOwner && (
          <Panel title="Zone sensible">
            <div className="p-5">
              <CampaignDangerZone
                campaignId={id}
                archived={archived}
                caseCount={casesRes.count ?? 0}
              />
            </div>
          </Panel>
        )}
      </div>
    </AppShell>
  );
}
