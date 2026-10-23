import { redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { FormSection, PageContainer, PageHeader } from "@/components/page-ui";
import { ScrollToHash } from "@/components/scroll-to-hash";
import { AccountNameForm } from "@/features/settings/components/account-name-form";
import { AgencyProfileForm } from "@/features/settings/components/agency-profile-form";
import { CampaignDefaultsForm } from "@/features/settings/components/campaign-defaults-form";
import { PasswordForm } from "@/features/settings/components/password-form";
import { SessionActions } from "@/features/settings/components/session-actions";
import { ThemeChoice } from "@/features/settings/components/theme-choice";
import { getAgencySettings } from "@/features/settings/server/settings";
import { GuideSetting } from "@/features/onboarding/components/guide-setting";
import { LocalCopySettings } from "@/features/local-copy/components/local-copy-settings";
import { NotificationPreferencesForm } from "@/features/notifications/components/notification-preferences";
import { PushDevice } from "@/features/notifications/components/push-device";
import { getPreferences } from "@/features/notifications/server/devices";
import { pushPublicKey } from "@/features/notifications/server/push";
import { BRAND } from "@/config/brand";
import { isOnboardingHidden } from "@/features/onboarding/server/onboarding";
import { DEFAULT_STAGES } from "@/features/stages/stages";
import { SubscriptionPanel } from "@/features/subscription/components/subscription-panel";
import { getSubscription, listPlatformPayments } from "@/features/subscription/server/subscription";
import { requireMember } from "@/lib/auth/require-member";
import { amountInputValue } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Réglages" };

// Réglages : le compte de chacun (nom, mot de passe, connexion) ; pour le
// patron, en plus, l'agence, les valeurs des nouvelles campagnes et
// l'abonnement.
export default async function SettingsPage() {
  const member = await requireMember();
  if (!member) redirect("/login");
  const { isOwner } = member;

  // Paiements de l'abonnement : demandés dès maintenant pour l'encart
  if (isOwner) void listPlatformPayments();
  const supabase = await createClient();
  const publicKey = pushPublicKey();
  const [{ data: claimsData }, subscription, agency, guideHidden, notificationPrefs] =
    await Promise.all([
      supabase.auth.getClaims(),
      getSubscription(member.agencyId),
      isOwner ? getAgencySettings(member.agencyId) : Promise.resolve(null),
      isOwner ? isOnboardingHidden(member.agencyId) : Promise.resolve(true),
      publicKey ? getPreferences(member) : Promise.resolve(null),
    ]);
  const email = typeof claimsData?.claims.email === "string" ? claimsData.claims.email : "";
  // Abonnement expiré : tout se consulte, rien ne se modifie (sauf le mot
  // de passe et la connexion, qui protègent le compte)
  const readOnly = subscription.state === "expired";

  return (
    <PageContainer>
      <ScrollToHash />
      <PageHeader
        title="Réglages"
        subtitle={isOwner ? "Votre compte et celui de l'agence" : "Votre compte"}
      />

      {readOnly && (
        <p className="flex items-start gap-2 rounded-xl border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          Abonnement expiré : les réglages se consultent mais ne se modifient plus. Le mot de
          passe peut toujours être changé.
        </p>
      )}

      <div className="space-y-8">
        <FormSection
          id="compte"
          title="Mon compte"
          description="Votre nom, tel que l'équipe le voit dans les dossiers et l'historique."
        >
          {email && (
            <div className="space-y-1">
              <p className="text-sm leading-none font-medium">E-mail de connexion</p>
              <p className="text-sm break-all text-muted-foreground">{email}</p>
            </div>
          )}
          <AccountNameForm
            initial={{ firstName: member.firstName, lastName: member.lastName }}
            readOnly={readOnly}
          />
        </FormSection>

        <FormSection
          id="apparence"
          title="Apparence"
          description="Retenu sur cet appareil."
        >
          <ThemeChoice />
        </FormSection>

        <FormSection
          id="notifications"
          title="Notifications"
          description="Sur votre téléphone ou votre ordinateur, même quand Tremplia est fermé. À activer sur chaque appareil. Vos choix ne valent que pour vous."
        >
          <PushDevice
            publicKey={publicKey}
            deviceUrl="/api/push/device"
            testUrl="/api/push/test"
            appName={BRAND.name}
            owner={member.userId}
          />
          {notificationPrefs && (
            <NotificationPreferencesForm
              initial={notificationPrefs}
              isOwner={isOwner}
              readOnly={readOnly}
            />
          )}
        </FormSection>

        <FormSection
          id="ordinateur"
          title="Sur cet ordinateur"
          description="Les documents des dossiers en cours, rangés comme dans Tremplia (campagne, groupe, candidat), pour les déposer facilement sur les plateformes. Propre à cet ordinateur et à votre compte."
        >
          <LocalCopySettings />
        </FormSection>

        {email && (
          <FormSection
            id="mot-de-passe"
            title="Mot de passe"
            description="Votre mot de passe actuel est demandé. Vos autres appareils sont ensuite déconnectés."
          >
            <PasswordForm email={email} />
          </FormSection>
        )}

        {isOwner && agency && (
          <FormSection
            id="agence"
            title="Agence"
            description="Le nom et le téléphone sont repris dans l'espace candidat et les messages WhatsApp."
          >
            <AgencyProfileForm
              initial={{ name: agency.name, city: agency.city, phone: agency.phone }}
              readOnly={readOnly}
            />
          </FormSection>
        )}

        {isOwner && agency && (
          <FormSection
            id="campagnes"
            title="Nouvelles campagnes"
            description="Proposés à chaque nouvelle campagne, puis modifiables sur la campagne. Les campagnes déjà créées ne changent pas."
          >
            <CampaignDefaultsForm
              initial={{
                defaultFee: amountInputValue(agency.defaultFee),
                platforms: agency.defaultPlatforms,
                stages: agency.defaultStages ?? [...DEFAULT_STAGES],
              }}
              readOnly={readOnly}
            />
          </FormSection>
        )}

        {isOwner && !readOnly && (
          <FormSection
            id="guide"
            title="Guide de démarrage"
            description="Les étapes « Bien démarrer » du tableau de bord, pour toute l'agence."
          >
            <GuideSetting hidden={guideHidden} />
          </FormSection>
        )}

        {isOwner && subscription.state !== "exempt" && (
          <FormSection
            id="abonnement"
            title="Abonnement"
            bare
          >
            <SubscriptionPanel agencyId={member.agencyId} title="État et paiements" />
          </FormSection>
        )}

        <FormSection
          id="connexion"
          title="Connexion"
          description="Fermez votre session sur cet appareil."
        >
          <SessionActions />
        </FormSection>
      </div>
    </PageContainer>
  );
}
