import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { PageContainer, PageHeader } from "@/components/page-ui";
import { CampaignSettingsForm } from "@/features/campaigns/components/campaign-settings-form";
import { requireOwner } from "@/lib/auth/require-owner";

export default async function NewCampaignPage() {
  if (!(await requireOwner())) redirect("/campaigns");

  return (
    <AppShell>
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
          initial={{ name: "", dates: [], infos: [], suggestedPlatforms: [] }}
        />
      </PageContainer>
    </AppShell>
  );
}
