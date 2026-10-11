import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { createClient } from "@/lib/supabase/server";
import { getCase } from "../get-case";

// Libellés lisibles. Le champ `details` du journal n'est jamais lu ni affiché.
const ACTION_LABELS: Record<string, string> = {
  "case.created": "a créé le dossier",
  "case.updated": "a modifié le dossier",
  "case.assigned": "a changé le responsable",
  "case.closed": "a clos le dossier",
  "case.abandoned": "a marqué le dossier comme abandonné",
  "case.reopened": "a rouvert le dossier",
  "pastel.credentials_updated": "a modifié le compte Pastel",
  "pastel.password_viewed": "a affiché le mot de passe Pastel",
  "document.added": "a ajouté un document",
  "document.renamed": "a renommé un document",
  "document.deleted": "a supprimé un document",
  "document.locked": "a verrouillé un document",
  "document.unlocked": "a déverrouillé un document",
  "document.moved": "a déplacé un document",
  "folder.created": "a créé un dossier de documents",
  "folder.renamed": "a renommé un dossier de documents",
  "folder.deleted": "a supprimé un dossier de documents",
};

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Algiers",
});

type LogRow = { id: string; actor_id: string | null; action: string; created_at: string };

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getCase(id))) notFound();

  const caller = await requireMember();
  if (caller?.profile.role !== "owner") {
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
            {ACTION_LABELS[r.action] ?? "a effectué une action"}
          </span>
          <time
            dateTime={r.created_at}
            className="text-xs text-muted-foreground"
          >
            {dateFormat.format(new Date(r.created_at))}
          </time>
        </li>
      ))}
    </ol>
  );
}
