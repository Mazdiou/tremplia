import Link from "next/link";
import { redirect } from "next/navigation";
import { Globe } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageContainer, PageHeader } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { listCampaigns } from "@/features/campaigns/server/queries";
import { SignupCard } from "@/features/signup/components/signup-card";
import { SignupLink } from "@/features/signup/components/signup-link";
import { SIGNUP_PATH, SIGNUP_RETENTION_DAYS } from "@/features/signup/schemas";
import { getSignupSettings, listSignups } from "@/features/signup/server/agency";
import { getAgencySettings } from "@/features/settings/server/settings";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { requireMember } from "@/lib/auth/require-member";
import { shortDateFormat } from "@/lib/dates";
import { plural } from "@/lib/plural";
import { siteUrl } from "@/lib/site-url";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inscriptions en ligne" };

// Demandes reçues sur la page d'inscription en ligne de l'agence, à
// accepter (création du dossier) ou à refuser. Toute l'équipe y a accès.
export default async function SignupsPage() {
  const member = await requireMember();
  if (!member) redirect("/login");

  const [signups, campaigns, settings, agency, readOnly] = await Promise.all([
    listSignups(),
    listCampaigns(),
    getSignupSettings(member.agencyId),
    getAgencySettings(member.agencyId),
    isReadOnly(member.agencyId),
  ]);
  const campaignNames = new Map(campaigns.map((c) => [c.id, c.name]));
  const url = settings.slug ? `${siteUrl()}${SIGNUP_PATH}/${settings.slug}` : null;
  const live = settings.enabled && settings.openCampaignIds.length > 0 && !readOnly;

  return (
    <PageContainer width="narrow">
      <PageHeader
        eyebrow={
          <Link href="/cases" className="hover:text-foreground">
            ← Dossiers
          </Link>
        }
        title="Inscriptions en ligne"
        subtitle={
          signups.length > 0
            ? `${plural(signups.length, "demande en attente", "demandes en attente")}. Sans réponse, une demande est supprimée après ${SIGNUP_RETENTION_DAYS} jours.`
            : "Demandes envoyées par les candidats depuis la page d'inscription de l'agence."
        }
        actions={
          member.isOwner && (
            <Link href="/settings#inscription" className={buttonVariants({ variant: "outline" })}>
              Régler la page
            </Link>
          )
        }
      />

      {url && live && agency && (
        <section aria-label="Adresse de la page" className="rounded-2xl border bg-card p-4 md:p-5">
          <p className="mb-3 text-sm text-muted-foreground">
            Partagez cette adresse sur Facebook, Instagram ou WhatsApp : chaque inscription
            arrive ici.
          </p>
          <SignupLink url={url} agencyName={agency.name} />
        </section>
      )}

      {signups.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="Aucune demande en attente"
          description={
            live
              ? "Les prochaines inscriptions s'afficheront ici."
              : member.isOwner
                ? "La page d'inscription est fermée. Ouvrez-la dans les Réglages et choisissez les campagnes proposées."
                : "La page d'inscription est fermée. Le patron peut l'ouvrir dans les Réglages."
          }
          action={
            member.isOwner &&
            !live &&
            !readOnly && (
              <Link href="/settings#inscription" className={buttonVariants()}>
                Ouvrir la page d&apos;inscription
              </Link>
            )
          }
        />
      ) : (
        <ul className="space-y-3">
          {signups.map((s) => (
            <SignupCard
              key={s.id}
              id={s.id}
              fields={s.fields}
              campaignName={(s.campaignId && campaignNames.get(s.campaignId)) || null}
              message={s.message}
              receivedOn={shortDateFormat.format(new Date(s.createdAt))}
              readOnly={readOnly}
            />
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
