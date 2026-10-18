import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { NewCaseLink, PageContainer, PageHeader } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { countdownLabel, timeline } from "@/features/campaigns/timeline";
import { listCampaignDates, listCampaigns } from "@/features/campaigns/server/queries";
import { requireMember } from "@/lib/auth/require-member";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { formatLongDate, todayInAppTimezone } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dossiers" };

// Aucun dossier sélectionné : les dates des campagnes actives
export default async function CasesHomePage() {
  const [member, campaigns] = await Promise.all([requireMember(), listCampaigns()]);
  const active = campaigns.filter((c) => c.status === "active");
  const today = todayInAppTimezone();
  const [readOnly, dates] = await Promise.all([
    member ? isReadOnly(member.agencyId) : false,
    listCampaignDates(active),
  ]);

  if (active.length === 0) {
    return (
      <PageContainer width="narrow">
        <EmptyState
          icon={CalendarDays}
          title="Aucune campagne active"
          description={
            member?.isOwner
              ? "Créez une campagne ou importez un modèle depuis la page Campagnes."
              : "Demandez au patron de créer une campagne."
          }
        />
        {member?.isOwner && (
          <div className="flex justify-center">
            <Link href="/campaigns" className={buttonVariants()}>
              Ouvrir les campagnes
            </Link>
          </div>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Dossiers"
        subtitle="Choisissez un dossier dans l'arbre, ou consultez les échéances de vos campagnes."
        actions={!readOnly && <NewCaseLink />}
      />
      {active.map((campaign) => {
        const items = timeline(
          dates.filter((d) => d.campaignId === campaign.id),
          today,
        );
        const nextIndex = items.findIndex((i) => i.days >= 0);
        return (
          <section key={campaign.id} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{campaign.name}</h2>
              <Link
                href={`/campaigns/${campaign.id}`}
                className="touch-target text-sm text-muted-foreground hover:text-foreground"
              >
                Voir la campagne
              </Link>
            </div>
            {items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucune date n&apos;est renseignée pour cette campagne.
              </p>
            ) : (
              <ul className="mt-4 divide-y">
                {items.map((item, i) => (
                  <li
                    key={`${item.label}-${item.date}`}
                    className={cn(
                      "flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm",
                      item.days < 0 && "text-muted-foreground",
                      i === nextIndex && "font-semibold",
                    )}
                  >
                    <span>
                      {item.label}
                      {i === nextIndex && (
                        <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                          Prochaine échéance
                        </span>
                      )}
                    </span>
                    <span>
                      {formatLongDate(item.date)}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({countdownLabel(item.days)})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </PageContainer>
  );
}
