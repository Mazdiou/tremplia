import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/require-member";
import { CaseForm, type Member } from "@/features/cases/components/case-form";
import { getCase } from "@/features/cases/server/get-case";

export default async function EditCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const caller = await requireMember();
  if (!caller) redirect("/login");

  const { id } = await params;
  const data = await getCase(id);
  if (!data) notFound();
  const { c } = data;

  const isOwner = caller.profile.role === "owner";

  // Seul le patron choisit le responsable. Le responsable actuel est
  // toujours dans la liste, même s'il est devenu inactif.
  let members: Member[] = [];
  if (isOwner) {
    const supabase = await createClient();
    const filter = c.assigned_to
      ? `is_active.eq.true,id.eq.${c.assigned_to}`
      : "is_active.eq.true";
    const { data: list } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role, is_active")
      .or(filter)
      .order("first_name");
    members = (list ?? []) as Member[];
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold">Modifier le dossier</h2>
      <CaseForm
        key={c.id}
        mode="edit"
        caseId={c.id}
        initial={{
          firstName: c.first_name,
          lastName: c.last_name,
          birthDate: c.birth_date,
          phone: c.phone,
          email: c.email ?? "",
          educationLevel: c.education_level,
          mainTrack: c.main_track ?? "",
          schools: c.schools,
          scope: c.scope,
          assignedTo: c.assigned_to ?? null,
          diplomas: c.diplomas,
          languageTests: c.language_tests,
        }}
        members={members}
        currentUserId={caller.user.id}
        isOwner={isOwner}
      />
    </div>
  );
}
