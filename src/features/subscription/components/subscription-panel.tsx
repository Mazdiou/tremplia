import { MetaList, Panel, StatusPill } from "@/components/page-ui";
import { dayFormat } from "@/lib/dates";
import {
  STATE_LABELS,
  STATE_TONES,
  daysLeft,
  formatEndDate,
  platformPaymentAmountLabel,
  platformPaymentMethodLabel,
} from "../subscription";
import { getSubscription, listPlatformPayments, supportPhone } from "../server/subscription";
import { plural } from "@/lib/plural";
import { telHref } from "@/lib/phone";

// Encart « Abonnement » de la page Réglages (patron) : état, fin, paiements
export async function SubscriptionPanel({
  agencyId,
  title = "Abonnement",
}: {
  agencyId: string;
  title?: string;
}) {
  const sub = await getSubscription(agencyId);
  // Agence de l'administrateur : pas d'abonnement, rien à afficher
  if (sub.state === "exempt") return null;
  // Lecture via le RLS : le patron voit les paiements de son agence
  const payments = await listPlatformPayments();
  const n = daysLeft(sub.endsAt);
  const phone = supportPhone();

  return (
    <Panel
      title={title}
      description={
        phone ? (
          <>
            Pour le renouveler, contactez-nous :{" "}
            <a href={telHref(phone)} className="underline">
              {phone}
            </a>
          </>
        ) : (
          "Pour le renouveler, contactez-nous."
        )
      }
      actions={<StatusPill tone={STATE_TONES[sub.state]}>{STATE_LABELS[sub.state]}</StatusPill>}
    >
      <div className="space-y-4 px-5 py-4">
        <p className="text-sm">
          {sub.state === "expired" ? (
            <>
              Expiré le <span className="font-medium">{formatEndDate(sub.endsAt)}</span> : l&apos;agence
              est en lecture seule.
            </>
          ) : (
            <>
              {sub.state === "trial" ? "Essai gratuit jusqu'au " : "Abonnement jusqu'au "}
              <span className="font-medium">{formatEndDate(sub.endsAt)}</span>
              <span className="text-muted-foreground">
                {" "}
                ({plural(n, "jour restant", "jours restants")})
              </span>
            </>
          )}
        </p>

        {payments.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Paiements
            </h3>
            <ul className="divide-y rounded-xl border text-sm">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 ${p.cancelled_at ? "text-muted-foreground" : ""}`}
                >
                  <span className="tabular-nums">{dayFormat.format(new Date(p.recorded_at))}</span>
                  <span className={p.cancelled_at ? "line-through" : "font-medium"}>
                    {platformPaymentAmountLabel(p)}
                  </span>
                  <MetaList
                    items={[`${p.months} mois`, p.method !== "gift" && platformPaymentMethodLabel(p.method)]}
                  />
                  {p.cancelled_at && (
                    <span className="text-xs">Annulé{p.cancel_reason ? ` : ${p.cancel_reason}` : ""}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Panel>
  );
}
