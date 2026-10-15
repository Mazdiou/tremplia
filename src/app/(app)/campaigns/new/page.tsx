import Link from "next/link";
import { redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-ui";
import { CampaignSettingsForm } from "@/features/campaigns/components/campaign-settings-form";
import { ReadOnlyNotice } from "@/features/subscription/components/read-only-notice";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { requireOwner } from "@/lib/auth/require-member";

export default async function NewCampaignPage() {
  const owner = await requireOwner();
  if (!owner) redirect("/campaigns");
  if (await isReadOnly(owner.agencyId)) {
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
        subtitle="Vous pourrez tout modifier ensuite. Astuce : un modèle préconfiguré remplit tout pour vous."
      />
      <CampaignSettingsForm
        initial={{ name: "", dates: [], infos: [], suggestedPlatforms: [], defaultFee: "" }}
      />
    </PageContainer>
  );
}
