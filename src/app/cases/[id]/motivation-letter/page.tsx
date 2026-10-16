import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { dateTimeFormat } from "@/lib/dates";
import { getCase } from "@/features/cases/server/get-case";
import { LetterEditor } from "@/features/motivation-letter/components/letter-editor";
import { memberNames } from "@/features/team/server/members";

export default async function MotivationLetterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getCase(id))) notFound();

  // Lecture via le RLS : seule une lettre de l'agence revient
  const supabase = await createClient();
  const { data: letter } = await supabase
    .from("case_motivation_letters")
    .select("content, updated_by, updated_at")
    .eq("case_id", id)
    .maybeSingle();

  let lastEdit: string | null = null;
  if (letter) {
    const author = letter.updated_by as string;
    const who = (await memberNames(supabase, [author])).get(author) ?? "un ancien membre";
    lastEdit = `par ${who}, le ${dateTimeFormat.format(new Date(letter.updated_at as string))}`;
  }

  return (
    <LetterEditor
      key={id}
      caseId={id}
      initial={(letter?.content as string | undefined) ?? ""}
      lastEdit={lastEdit}
    />
  );
}
