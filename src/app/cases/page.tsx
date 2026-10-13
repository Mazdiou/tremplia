import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { countdownLabel, timeline } from "@/features/campaigns/timeline";
import { listCampaignDates, listCampaigns } from "@/features/campaigns/server/queries";
import { requireMember } from "@/lib/auth/require-member";
import { formatLongDate, todayInAppTimezone } from "@/lib/dates";
import { cn } from "@/lib/utils";

// Aucun dossier sélectionné : les dates des campagnes actives
export default async function CasesHomePage() {
  const member = await requireMember();
  const active = (await listCampaigns()).filter((c) => c.status === "active");
  const today = todayInAppTimezone();
  const dates = await listCampaignDates(active);

  if (active.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-8">
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
          <p className="mt-4 text-center text-sm">
            <Link href="/campaigns" className="underline">
              Ouvrir les campagnes
            </Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      {active.map((campaign) => {
        const items = timeline(
          dates.filter((d) => d.campaignId === campaign.id),
          today,
        );
        const nextIndex = items.findIndex((i) => i.days >= 0);
        return (
          <section key={campaign.id} className="rounded-lg border p-5">
            <h1 className="text-xl font-semibold">{campaign.name}</h1>
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
                        <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
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

      <p className="text-center text-sm text-muted-foreground">
        Sélectionnez un dossier dans l&apos;arbre à gauche, ou créez un nouveau
        dossier.
      </p>
    </div>
  );
}
