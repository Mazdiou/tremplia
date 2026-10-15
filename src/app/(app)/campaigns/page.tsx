import Link from "next/link";
import { CalendarClock, CalendarRange, FolderOpen, Layers } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader, StatusPill } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { CAMPAIGN_TEMPLATES } from "@/config/campaign-templates";
import { CAMPAIGN_STATUS_LABELS } from "@/features/campaigns/labels";
import { TemplateGallery } from "@/features/campaigns/components/template-gallery";
import {
  listCampaignDates,
  listCampaigns,
  listGroups,
  type CampaignSummary,
} from "@/features/campaigns/server/queries";
import { countdownLabel, nextDeadline, type TimelineItem } from "@/features/campaigns/timeline";
import { requireMember } from "@/lib/auth/require-member";
import { formatLongDate, todayInAppTimezone } from "@/lib/dates";
import { countCases } from "@/features/cases/case-stats";
import { listCaseStats } from "@/features/cases/server/case-stats";
import { cn } from "@/lib/utils";

type CardData = CampaignSummary & {
  activeCases: number;
  groupCount: number;
  next: TimelineItem | null;
};

function CampaignCard({ c }: { c: CardData }) {
  const archived = c.status === "archived";
  return (
    <Link
      href={`/campaigns/${c.id}`}
      className={cn(
        "group flex h-full flex-col rounded-2xl border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-highlight/40",
        archived && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold group-hover:text-primary">{c.name}</h2>
        <StatusPill tone={archived ? "off" : "ok"}>{CAMPAIGN_STATUS_LABELS[c.status]}</StatusPill>
      </div>
      <dl className="mt-4 mb-4 grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FolderOpen className="size-4" aria-hidden />
          <dt className="sr-only">Dossiers actifs</dt>
          <dd>
            <span className="font-medium text-foreground tabular-nums">{c.activeCases}</span>{" "}
            dossier{c.activeCases > 1 ? "s" : ""} actif{c.activeCases > 1 ? "s" : ""}
          </dd>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Layers className="size-4" aria-hidden />
          <dt className="sr-only">Groupes</dt>
          <dd>
            <span className="font-medium text-foreground tabular-nums">{c.groupCount}</span>{" "}
            groupe{c.groupCount > 1 ? "s" : ""}
          </dd>
        </div>
      </dl>
      <div className="mt-auto flex items-center gap-2 border-t pt-3 text-sm">
        <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        {c.next ? (
          <>
            <span className="min-w-0 truncate" title={formatLongDate(c.next.date)}>
              {c.next.label}
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {countdownLabel(c.next.days)}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">Aucune échéance à venir</span>
        )}
      </div>
    </Link>
  );
}

export default async function CampaignsPage() {
  const [member, campaigns] = await Promise.all([requireMember(), listCampaigns()]);
  // Dossiers actifs par campagne : une lecture pour toutes (vue case_stats)
  const [dates, groups, stats] = await Promise.all([
    listCampaignDates(campaigns),
    listGroups(campaigns.map((c) => c.id)),
    listCaseStats(),
  ]);
  const today = todayInAppTimezone();

  const cards: CardData[] = campaigns.map((c) => ({
    ...c,
    activeCases: countCases(stats, { campaignId: c.id, status: "active" }),
    groupCount: groups.filter((g) => g.campaign_id === c.id).length,
    next: nextDeadline(dates.filter((d) => d.campaignId === c.id), today),
  }));
  const active = cards.filter((c) => c.status === "active");
  const archived = cards.filter((c) => c.status === "archived");

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Campagnes"
        subtitle={
          member?.isOwner
            ? "Créez vos campagnes ou partez d'un modèle préconfiguré."
            : "Consultation seulement : le patron gère les campagnes, vous gérez les groupes."
        }
        actions={
          member?.isOwner && (
            <>
              <a href="#modeles" className={buttonVariants({ variant: "outline" })}>
                Importer un modèle
              </a>
              <Link href="/campaigns/new" className={buttonVariants()}>
                Créer une campagne
              </Link>
            </>
          )
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Aucune campagne"
          description={
            member?.isOwner
              ? "Créez votre première campagne ou importez un modèle préconfiguré ci-dessous."
              : "Le patron de l'agence doit créer une campagne."
          }
        />
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                En cours · {active.length}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {active.map((c) => (
                  <li key={c.id}>
                    <CampaignCard c={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {archived.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Archivées · {archived.length}
              </h2>
              <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {archived.map((c) => (
                  <li key={c.id}>
                    <CampaignCard c={c} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {member?.isOwner && (
        <section id="modeles" className="scroll-mt-6 space-y-3 border-t pt-6">
          <div>
            <h2 className="text-lg font-semibold">Modèles préconfigurés</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              L&apos;import crée une copie de la campagne dans votre agence :
              vous pouvez ensuite tout modifier.
            </p>
          </div>
          <TemplateGallery
            templates={CAMPAIGN_TEMPLATES}
            importedKeys={campaigns.flatMap((c) => (c.template_key ? [c.template_key] : []))}
          />
        </section>
      )}
    </PageContainer>
  );
}
