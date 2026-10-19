import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fullName } from "@/lib/names";
import { todayInAppTimezone } from "@/lib/dates";
import { readAll } from "@/lib/supabase/read-all";
import type { TaskMember } from "@/features/tasks/types";
import { reportError } from "@/lib/report-error";

// Lectures via le RLS : seules les tâches et les membres de l'agence de la
// session reviennent.

// Membres de l'agence (responsables possibles et noms affichés). En cache
// pour la requête : l'en-tête du dossier et l'onglet Tâches le partagent.
export const listTaskMembers = cache(async (): Promise<TaskMember[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, is_active")
    .order("first_name");
  if (error) reportError("[tasks members]", error.code);
  return ((data ?? []) as { id: string; first_name: string; last_name: string; is_active: boolean }[]).map(
    (p) => ({ id: p.id, name: fullName(p.first_name, p.last_name), isActive: p.is_active }),
  );
});

// Nombre de tâches à faire du dossier (onglet, question à la clôture)
export const countOpenCaseTasks = cache(async (caseId: string): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("case_tasks")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .is("done_at", null);
  if (error) reportError("[tasks count]", error.code);
  return count ?? 0;
});

export type TaskRow = {
  id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  assigned_to: string;
  created_by: string;
  done_at: string | null;
  done_by: string | null;
  created_at: string;
};

const DONE_SHOWN = 50;

// Toutes les tâches à faire (100 au plus), et les dernières faites
export async function listCaseTasks(caseId: string) {
  const supabase = await createClient();
  const columns = "id, title, details, due_date, assigned_to, created_by, done_at, done_by, created_at";
  const [open, done] = await Promise.all([
    supabase.from("case_tasks").select(columns).eq("case_id", caseId).is("done_at", null),
    supabase
      .from("case_tasks")
      .select(columns, { count: "exact" })
      .eq("case_id", caseId)
      .not("done_at", "is", null)
      .order("done_at", { ascending: false })
      .limit(DONE_SHOWN),
  ]);
  if (open.error) reportError("[tasks list open]", open.error.code);
  if (done.error) reportError("[tasks list done]", done.error.code);
  return {
    open: (open.data ?? []) as TaskRow[],
    done: (done.data ?? []) as TaskRow[],
    doneTotal: done.count ?? 0,
  };
}

// --- Vue d'ensemble (page Tâches, menu, tableau de bord, arbre) -------------

// Dossiers des campagnes actives seulement : comme la page Tâches par
// défaut, la pastille et le tableau de bord ignorent les campagnes archivées
const ACTIVE_CAMPAIGN = "case:cases!case_tasks_case_fk!inner(campaign:campaigns!cases_campaign_fk!inner(status))";

// Mes tâches à faire en retard et du jour (pastille du menu)
export const myTaskCounts = cache(async (userId: string) => {
  const supabase = await createClient();
  const today = todayInAppTimezone();
  const { data, error } = await supabase
    .from("case_tasks")
    .select(`due_date, ${ACTIVE_CAMPAIGN}`)
    .eq("case.campaign.status", "active")
    .eq("assigned_to", userId)
    .is("done_at", null)
    .lte("due_date", today)
    .limit(1000);
  if (error) reportError("[tasks my counts]", error.code);
  const dates = ((data ?? []) as { due_date: string }[]).map((r) => r.due_date);
  return {
    overdue: dates.filter((d) => d < today).length,
    today: dates.filter((d) => d === today).length,
  };
});

// Tâches en retard par dossier, toute l'agence (horloge et filtre de l'arbre)
export async function overdueTasksByCase(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const today = todayInAppTimezone();
  try {
    const rows = await readAll<{ case_id: string }>((from, to) =>
      supabase
        .from("case_tasks")
        .select("case_id")
        .is("done_at", null)
        .lt("due_date", today)
        .order("id")
        .range(from, to),
    );
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.case_id] = (counts[r.case_id] ?? 0) + 1;
    return counts;
  } catch {
    reportError("[tasks overdue by case]");
    return {};
  }
}

export type AgencyTaskRow = TaskRow & {
  case_id: string;
  case: {
    first_name: string;
    last_name: string;
    status: string;
    campaign_id: string;
  } | null;
};

const AGENCY_COLUMNS = `id, case_id, title, details, due_date, assigned_to, created_by, done_at,
  done_by, created_at, case:cases!case_tasks_case_fk(first_name, last_name, status, campaign_id)`;

// Tâches de l'agence : toutes celles à faire, et celles faites ces
// `doneDays` derniers jours. `assignee` : un membre, ou toute l'équipe (null).
export async function listAgencyTasks(assignee: string | null, doneDays: number) {
  const supabase = await createClient();
  const doneSince = new Date(Date.now() - doneDays * 86_400_000).toISOString();
  const base = () => {
    const q = supabase.from("case_tasks").select(AGENCY_COLUMNS);
    return assignee ? q.eq("assigned_to", assignee) : q;
  };
  const [open, done] = await Promise.all([
    readAll<AgencyTaskRow>((from, to) =>
      base().is("done_at", null).order("id").range(from, to),
    ),
    base().gte("done_at", doneSince).order("done_at", { ascending: false }).limit(200),
  ]);
  if (done.error) reportError("[tasks agency done]", done.error.code);
  return { open, done: (done.data ?? []) as unknown as AgencyTaskRow[] };
}

// Tableau de bord : mes prochaines tâches à faire (les plus urgentes d'abord)
// et, pour le patron, le nombre de tâches en retard de toute l'équipe
export async function loadMyTasks(userId: string, withTeam: boolean) {
  const supabase = await createClient();
  const today = todayInAppTimezone();
  const [mine, team] = await Promise.all([
    supabase
      .from("case_tasks")
      .select(`${AGENCY_COLUMNS}, active:cases!case_tasks_case_fk!inner(campaign:campaigns!cases_campaign_fk!inner(status))`)
      .eq("active.campaign.status", "active")
      .eq("assigned_to", userId)
      .is("done_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at")
      .limit(MAX_DASHBOARD_TASKS),
    withTeam
      ? supabase
          .from("case_tasks")
          .select(`id, ${ACTIVE_CAMPAIGN}`, { count: "exact", head: true })
          .eq("case.campaign.status", "active")
          .is("done_at", null)
          .lt("due_date", today)
      : null,
  ]);
  if (mine.error) reportError("[tasks dashboard]", mine.error.code);
  if (team?.error) reportError("[tasks dashboard team]", team.error.code);
  return {
    rows: (mine.data ?? []) as unknown as AgencyTaskRow[],
    teamOverdue: team?.count ?? null,
  };
}

// Assez pour compter les tâches de la semaine sans tout lire
const MAX_DASHBOARD_TASKS = 200;
