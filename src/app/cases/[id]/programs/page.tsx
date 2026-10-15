import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCase } from "@/features/cases/server/get-case";
import {
  ProgramsPanel,
  type ProgramItem,
} from "@/features/programs/components/programs-panel";

export default async function ProgramsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getCase(id))) notFound();

  // Lecture via le RLS : seules les formations de l'agence reviennent
  const supabase = await createClient();
  const { data } = await supabase
    .from("case_programs")
    .select("id, title, level, city, institution, result")
    .eq("case_id", id)
    .order("position");

  return <ProgramsPanel caseId={id} programs={(data ?? []) as ProgramItem[]} />;
}
