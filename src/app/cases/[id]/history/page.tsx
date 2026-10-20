import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { createClient } from "@/lib/supabase/server";
import { getCase } from "@/features/cases/server/get-case";
import { activityActor, activityLabel } from "@/features/history/labels";
import { dateTimeFormat } from "@/lib/dates";
import { memberNames } from "@/features/team/server/members";
import { buttonVariants } from "@/components/ui/button";

// Le champ `details` du journal n'est jamais lu ni affiché.
type LogRow = { id: string; actor_id: string | null; action: string; created_at: string };

const PAGE_SIZE = 200;

// Numéro de page de l'adresse (?page=2), 1 si absent ou invalide
function pageOf(value: string | string[] | undefined) {
  const n = Number(typeof value === "string" ? value : 1);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 1;
}

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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

  const page = pageOf((await searchParams).page);
  const from = (page - 1) * PAGE_SIZE;

  // Lecture via le RLS : le journal n'est lisible que par le patron. Une
  // ligne de plus que la page dit s'il en reste de plus anciennes.
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_log")
    .select("id, actor_id, action, created_at")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE);
  const all = (data ?? []) as LogRow[];
  const hasOlder = all.length > PAGE_SIZE;
  const rows = all.slice(0, PAGE_SIZE);

  const names = await memberNames(supabase, [
    ...new Set(rows.flatMap((r) => (r.actor_id ? [r.actor_id] : []))),
  ]);

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        {page === 1 ? "Aucune action enregistrée pour ce dossier." : "Aucune action plus ancienne."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="divide-y rounded-xl border">
        {rows.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2.5 text-sm"
          >
            <span>
              <span className="font-medium">
                {activityActor(r.action, r.actor_id && names.get(r.actor_id), "case")}
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

      {(page > 1 || hasOlder) && (
        <nav aria-label="Pages de l'historique" className="flex items-center justify-between gap-2">
          {page > 1 ? (
            <Link
              href={page === 2 ? `/cases/${id}/history` : `?page=${page - 1}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Plus récentes
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">Page {page}</span>
          {hasOlder ? (
            <Link
              href={`?page=${page + 1}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Plus anciennes
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
