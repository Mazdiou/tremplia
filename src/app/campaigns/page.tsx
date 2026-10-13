import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PageHeader, Panel, StatusPill } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { CAMPAIGN_TEMPLATES } from "@/config/campaign-templates";
import { CAMPAIGN_STATUS_LABELS } from "@/features/campaigns/labels";
import { TemplateGallery } from "@/features/campaigns/components/template-gallery";
import { listCampaignDates, listCampaigns } from "@/features/campaigns/server/queries";
import { countdownLabel, nextDeadline } from "@/features/campaigns/timeline";
import { requireMember } from "@/lib/auth/require-member";
import { formatLongDate, todayInAppTimezone } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export default async function CampaignsPage() {
  const member = await requireMember();
  const campaigns = await listCampaigns();
  const dates = await listCampaignDates(campaigns);
  const today = todayInAppTimezone();

  // Dossiers actifs par campagne (lecture via le RLS)
  const supabase = await createClient();
  const counts = new Map(
    await Promise.all(
      campaigns.map(async (c) => {
        const { count } = await supabase
          .from("cases")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", c.id)
          .eq("status", "active");
        return [c.id, count ?? 0] as const;
      }),
    ),
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
        <PageHeader
          title="Campagnes"
          subtitle={
            member?.isOwner
              ? "Vos campagnes en cours et archivées"
              : "Consultation seulement : le patron gère les campagnes"
          }
          actions={
            member?.isOwner && (
              <div className="flex gap-2">
                <a href="#modeles" className={buttonVariants({ variant: "outline" })}>
                  Importer un modèle
                </a>
                <Link href="/campaigns/new" className={buttonVariants()}>
                  Créer une campagne
                </Link>
              </div>
            )
          }
        />

        {campaigns.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Aucune campagne"
            description={
              member?.isOwner
                ? "Créez votre première campagne ou importez un modèle préconfiguré."
                : "Le patron de l'agence doit créer une campagne."
            }
          />
        ) : (
          <Panel title="Toutes les campagnes">
            <ul>
              {campaigns.map((c) => {
                const next = nextDeadline(
                  dates.filter((d) => d.campaignId === c.id),
                  today,
                );
                const n = counts.get(c.id) ?? 0;
                return (
                  <li key={c.id} className="border-b last:border-b-0">
                    <Link
                      href={`/campaigns/${c.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-[18px] py-3 text-sm hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1 font-medium">{c.name}</span>
                      <StatusPill tone={c.status === "active" ? "ok" : "off"}>
                        {CAMPAIGN_STATUS_LABELS[c.status]}
                      </StatusPill>
                      <span className="w-32 text-muted-foreground tabular-nums">
                        {n} dossier{n > 1 ? "s" : ""} actif{n > 1 ? "s" : ""}
                      </span>
                      <span className="w-64 text-muted-foreground max-md:w-full">
                        {next
                          ? `${next.label} : ${formatLongDate(next.date)} (${countdownLabel(next.days)})`
                          : "Aucune échéance à venir"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {member?.isOwner && (
          <section id="modeles" className="scroll-mt-6 space-y-3">
            <h2 className="text-lg font-semibold">Modèles préconfigurés</h2>
            <p className="text-sm text-muted-foreground">
              L&apos;import crée une copie de la campagne dans votre agence :
              vous pouvez ensuite tout modifier.
            </p>
            <TemplateGallery
              templates={CAMPAIGN_TEMPLATES}
              importedKeys={campaigns.flatMap((c) => (c.template_key ? [c.template_key] : []))}
            />
          </section>
        )}
      </div>
    </AppShell>
  );
}
