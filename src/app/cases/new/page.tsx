import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/auth/require-member";
import { CaseForm } from "@/features/cases/components/case-form";

export default async function NewCasePage() {
  const caller = await requireMember();
  if (!caller) redirect("/login");

  const isOwner = caller.profile.role === "owner";

  let members: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
  }[] = [];

  // Seul le patron choisit un responsable : on ne charge la liste que pour lui
  if (isOwner) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, role")
      .eq("is_active", true)
      .order("first_name");
    members = data ?? [];
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nouveau dossier</h1>
        <Link href="/dashboard" className="text-sm underline">
          Retour au tableau de bord
        </Link>
      </div>
      <CaseForm
        mode="create"
        members={members}
        currentUserId={caller.user.id}
        isOwner={isOwner}
      />
    </main>
  );
}
