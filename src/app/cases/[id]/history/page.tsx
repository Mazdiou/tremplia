import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { createClient } from "@/lib/supabase/server";
import { getCase } from "@/features/cases/server/get-case";
import { activityLabel } from "@/features/history/labels";
import { dateTimeFormat } from "@/lib/dates";

// Le champ `details` du journal n'est jamais lu ni affiché.
type LogRow = { id: string; actor_id: string | null; action: string; created_at: string };

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getCase(id))) notFound();

  const caller = await requireMember();
  if (!caller?.isOwner) {
    return (
      <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        L&apos;historique est réservé au patron de l&apos;agence.
      </p>
    );
  }

  // Lecture via le RLS : le journal n'est lisible que par le patron.
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("id, actor_id, action, created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as LogRow[];

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", actorIds as string[]);
    for (const p of (profiles ?? []) as {
      id: string;
      first_name: string;
      last_name: string;
    }[]) {
      names.set(p.id, `${p.first_name} ${p.last_name}`);
    }
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        Aucune action enregistrée pour ce dossier.
      </p>
    );
  }

  return (
    <ol className="divide-y rounded-xl border">
      {rows.map((r) => (
        <li
          key={r.id}
          className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm"
        >
          <span>
            <span className="font-medium">
              {(r.actor_id && names.get(r.actor_id)) || "Un ancien membre"}
            </span>{" "}
            {activityLabel(r.action, "case")}
          </span>
          <time
            dateTime={r.created_at}
            className="text-xs text-muted-foreground"
          >
            {dateTimeFormat.format(new Date(r.created_at))}
          </time>
        </li>
      ))}
    </ol>
  );
}
