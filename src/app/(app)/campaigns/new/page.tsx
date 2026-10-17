import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-ui";
import { CampaignSettingsForm } from "@/features/campaigns/components/campaign-settings-form";
import { getAgencySettings } from "@/features/settings/server/settings";
import { DEFAULT_STAGES } from "@/features/stages/stages";
import { ReadOnlyNotice } from "@/features/subscription/components/read-only-notice";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { requireOwner } from "@/lib/auth/require-member";
import { amountInputValue } from "@/lib/money";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Nouvelle campagne" };

export default async function NewCampaignPage() {
  const owner = await requireOwner();
  if (!owner) redirect("/campaigns");
  const [readOnly, settings] = await Promise.all([
    isReadOnly(owner.agencyId),
    getAgencySettings(owner.agencyId),
  ]);
  if (readOnly) {
    return <ReadOnlyNotice backHref="/campaigns" backLabel="Retour aux campagnes" />;
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <Link href="/campaigns" className="hover:text-foreground">
            Campagnes
          </Link>
        }
        title="Nouvelle campagne"
        subtitle={
          <>
            Vous pourrez tout modifier ensuite. Le tarif, les plateformes et les étapes
            proposés viennent des{" "}
            <Link href="/settings#campagnes" className="underline hover:text-foreground">
              réglages de l&apos;agence
            </Link>
            .
          </>
        }
      />
      <CampaignSettingsForm
        initial={{
          name: "",
          dates: [],
          infos: [],
          suggestedPlatforms: settings?.defaultPlatforms ?? [],
          defaultFee: amountInputValue(settings?.defaultFee),
        }}
        initialStages={settings?.defaultStages ?? [...DEFAULT_STAGES]}
      />
    </PageContainer>
  );
}
