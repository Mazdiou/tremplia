import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { createClient } from "@/lib/supabase/server";
import { getCase } from "@/features/cases/server/get-case";
import { dateTimeFormat } from "@/lib/dates";
import { NotesPanel, type NoteItem } from "@/features/notes/components/notes-panel";
import { memberNames } from "@/features/team/server/members";
import { isReadOnly } from "@/features/subscription/server/subscription";

const PAGE_SIZE = 200;

type Row = {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  edited_by: string | null;
};

export default async function NotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getCase(id))) notFound();

  const caller = await requireMember();
  if (!caller) notFound();
  const isOwner = caller.isOwner;

  // Lecture via le RLS : seules les notes de l'agence reviennent.
  const supabase = await createClient();
  const [{ data }, readOnly] = await Promise.all([
    supabase
      .from("case_notes")
      .select("id, author_id, content, created_at, edited_at, edited_by")
      .eq("case_id", id)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE + 1),
    // Abonnement expiré : consultation seulement
    isReadOnly(caller.agencyId),
  ]);
  const all = (data ?? []) as Row[];
  const truncated = all.length > PAGE_SIZE;
  const rows = all.slice(0, PAGE_SIZE);

  const personIds = [
    ...new Set(
      rows.flatMap((r) => (r.edited_by ? [r.author_id, r.edited_by] : [r.author_id])),
    ),
  ];
  const names = await memberNames(supabase, personIds);
  const nameOf = (userId: string) => names.get(userId) ?? "un ancien membre";

  const notes: NoteItem[] = rows.map((r) => {
    const mine = r.author_id === caller.userId;
    let editedLabel: string | null = null;
    if (r.edited_at && r.edited_by) {
      const when = dateTimeFormat.format(new Date(r.edited_at));
      editedLabel =
        r.edited_by === r.author_id
          ? `modifiée le ${when}`
          : `modifiée par ${nameOf(r.edited_by)}, le ${when}`;
    }
    return {
      id: r.id,
      authorName: nameOf(r.author_id),
      content: r.content,
      dateLabel: dateTimeFormat.format(new Date(r.created_at)),
      editedLabel,
      // Affichage seulement : la vraie règle est appliquée par la base
      canManage: isOwner || mine,
    };
  });

  return <NotesPanel caseId={id} notes={notes} truncated={truncated} readOnly={readOnly} />;
}
