import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/require-member";
import { toCaseDraft } from "@/features/cases/case-record";
import { CaseForm, type Member } from "@/features/cases/components/case-form";
import { getCase } from "@/features/cases/server/get-case";
import { ReadOnlyNotice } from "@/features/subscription/components/read-only-notice";
import { isReadOnly } from "@/features/subscription/server/subscription";

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const member = await requireMember();
  if (!member) redirect("/login");

  const { id } = await params;
  const data = await getCase(id);
  if (!data || !data.campaign) notFound();
  const { c, campaign, campaignGroups, groups } = data;
  if (await isReadOnly(member.agencyId)) {
    return <ReadOnlyNotice backHref={`/cases/${c.id}`} backLabel="Retour au dossier" />;
  }

  // Seul le patron choisit le responsable. Le responsable actuel est
  // toujours dans la liste, même s'il est devenu inactif.
  let members: Member[] = [];
  if (member.isOwner) {
    const supabase = await createClient();
    const { data: list } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, is_active")
      .order("first_name");
    members = ((list ?? []) as Member[]).filter(
      (m) => m.is_active || m.id === c.assigned_to,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Modifier le dossier</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les champs marqués d&apos;un astérisque sont obligatoires.
        </p>
      </div>
      <CaseForm
        key={c.id}
        mode="edit"
        caseId={c.id}
        campaign={{
          id: campaign.id,
          name: campaign.name,
          groups: campaignGroups,
          suggestedPlatforms: campaign.suggested_platforms,
          defaultFee: campaign.default_fee,
        }}
        initial={{
          fields: toCaseDraft(c),
          groupIds: groups.map((g) => g.id),
          assignedTo: c.assigned_to,
        }}
        members={members}
        isOwner={member.isOwner}
        currentUserId={member.userId}
      />
    </div>
  );
}
