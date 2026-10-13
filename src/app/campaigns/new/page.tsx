import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { PageHeader } from "@/components/page-ui";
import { CampaignSettingsForm } from "@/features/campaigns/components/campaign-settings-form";
import { requireOwner } from "@/lib/auth/require-owner";

export default async function NewCampaignPage() {
  if (!(await requireOwner())) redirect("/campaigns");

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <PageHeader
          title="Nouvelle campagne"
          actions={
            <Link href="/campaigns" className="text-sm underline">
              Retour aux campagnes
            </Link>
          }
        />
        <div className="rounded-2xl border bg-card p-5">
          <CampaignSettingsForm
            initial={{ name: "", dates: [], infos: [], suggestedPlatforms: [] }}
          />
        </div>
      </div>
    </AppShell>
  );
}
