import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCase } from "@/features/cases/server/get-case";
import { requireMember } from "@/lib/auth/require-member";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { ProgramsPanel } from "@/features/programs/components/programs-panel";
import type { ProgramItem } from "@/features/programs/schemas";

export default async function ProgramsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [found, member, supabase] = await Promise.all([getCase(id), requireMember(), createClient()]);
  if (!found || !member) notFound();

  // Lecture via le RLS : seules les formations de l'agence reviennent.
  // Abonnement expiré : consultation seulement.
  const [{ data }, readOnly] = await Promise.all([
    supabase
      .from("case_programs")
      .select("id, title, level, city, institution, result")
      .eq("case_id", id)
      .order("position"),
    isReadOnly(member.agencyId),
  ]);

  return (
    <ProgramsPanel caseId={id} programs={(data ?? []) as ProgramItem[]} readOnly={readOnly} />
  );
}
