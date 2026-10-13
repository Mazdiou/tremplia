import { createClient } from "@/lib/supabase/server";
import {
  campaignTimeline,
  type CampaignRow,
} from "@/features/campaigns/timeline";
import { formatLongDate, todayInAppTimezone } from "@/lib/dates";

function relative(days: number) {
  if (days < 0) return "passée";
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${days} jours`;
}

export default async function CasesHomePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("campaigns")
    .select("*")
    .eq("is_current", true)
    .maybeSingle();
  const campaign = data as CampaignRow | null;
  const timeline = campaign
    ? campaignTimeline(campaign, todayInAppTimezone())
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <section className="rounded-lg border p-5">
        {campaign && timeline ? (
          <>
            <h1 className="text-xl font-semibold">Campagne {campaign.label}</h1>
            {timeline.items.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucune date n&apos;est renseignée pour cette campagne.
              </p>
            ) : (
              <ul className="mt-4 divide-y">
                {timeline.items.map((item) => {
                  const isNext = item.key === timeline.nextKey;
                  const isPast = item.days < 0;
                  return (
                    <li
                      key={item.key}
                      className={`flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm ${
                        isPast ? "text-muted-foreground" : ""
                      } ${isNext ? "font-semibold" : ""}`}
                    >
                      <span>
                        {item.label}
                        {isNext && (
                          <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
                            Prochaine échéance
                          </span>
                        )}
                      </span>
                      <span>
                        {formatLongDate(item.date)}{" "}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({relative(item.days)})
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune campagne en cours.
          </p>
        )}
      </section>

      <p className="text-center text-sm text-muted-foreground">
        Sélectionnez un dossier dans l&apos;arbre à gauche, ou créez un nouveau
        dossier.
      </p>
    </div>
  );
}
