import { CircleAlert, Info, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { subscriptionNotice } from "../subscription";
import { getSubscription, supportPhone } from "../server/subscription";
import { telHref } from "@/lib/phone";

const TONES = {
  info: "border-primary/20 bg-primary/10 text-foreground",
  warn: "border-amber-300/60 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100",
  bad: "border-destructive/30 bg-destructive/10 text-foreground",
};
const ICONS = { info: Info, warn: CircleAlert, bad: Lock };

// Bandeau d'abonnement en haut de l'appli : essai, fin proche ou expiré
export async function SubscriptionBanner({ agencyId }: { agencyId: string }) {
  const notice = subscriptionNotice(await getSubscription(agencyId));
  if (!notice) return null;
  const phone = supportPhone();
  const Icon = ICONS[notice.tone];
  return (
    // Zone nommée, pas « annoncée » : présente dès l'ouverture de chaque page,
    // elle serait sinon relue à chaque navigation par les lecteurs d'écran
    <aside
      aria-label="Abonnement"
      className={cn("flex items-start gap-2 border-b px-4 py-2 text-sm md:px-6", TONES[notice.tone])}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        {notice.text}
        {phone ? (
          <>
            {", contactez-nous : "}
            <a href={telHref(phone)} className="font-medium whitespace-nowrap underline">
              {phone}
            </a>
            .
          </>
        ) : (
          ", contactez-nous."
        )}
      </p>
    </aside>
  );
}
