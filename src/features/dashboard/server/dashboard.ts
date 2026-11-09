import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAll } from "@/lib/supabase/read-all";
import { PROGRAM_RESULTS, type ProgramResult } from "@/features/programs/schemas";
import { groupActivity, type ActivityGroup, type ActivityRow } from "../activity";
import { plural } from "@/lib/plural";
import { displayName, fullName } from "@/lib/names";
import { reportError } from "@/lib/report-error";
import { lastMonths } from "../months";

// Lectures du tableau de bord, via le RLS (dossiers de l'agence seulement).

type Named = { id: string; first_name: string; last_name: string };

export type TodoItem = Named & { when: string | null; detail: string };

export type Todo = {
  // Demandes reçues sur la page d'inscription en ligne (identifiant de la
  // demande, pas d'un dossier)
  signups: TodoItem[];
  // Le candidat demande une modification de sa lettre ou de ses formations
  changes: TodoItem[];
  // Messages du candidat que personne n'a lus
  unread: TodoItem[];
  // Le candidat a tout validé et des formations restent à envoyer
  approved: TodoItem[];
};

// « À traiter » : ce qui attend une action de l'agence, sur les dossiers
// actifs des campagnes affichées. Deux temps seulement : les avis des
// candidats et les messages non lus ensemble, puis les noms des candidats
// (messages) et les formations à envoyer (avis validés) ensemble.
export async function loadTodo(
  supabase: SupabaseClient,
  campaignIds: string[],
  unreadPromise: Promise<Record<string, number>>,
): Promise<Todo> {
  const [unread, reviewsRes, signupsRes] = await Promise.all([
    unreadPromise,
    supabase
      .from("case_student_reviews")
      .select("case_id, status, responded_at, cases!inner(id, first_name, last_name, status, campaign_id)")
      .in("status", ["approved", "changes_requested"])
      .eq("cases.status", "active")
      .in("cases.campaign_id", campaignIds)
      .order("responded_at", { ascending: false })
      .limit(200),
    supabase
      .from("online_signups")
      .select("id, campaign_id, fields, created_at")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (reviewsRes.error) reportError("[dashboard todo]", reviewsRes.error.code);
  if (signupsRes.error) reportError("[dashboard todo signups]", signupsRes.error.code);

  // Demandes des campagnes affichées, et celles dont la campagne a été
  // supprimée depuis (elles attendent aussi une réponse)
  const shown = new Set(campaignIds);
  const signups = (
    (signupsRes.data ?? []) as {
      id: string;
      campaign_id: string | null;
      fields: { first_name: string; last_name: string };
      created_at: string;
    }[]
  )
    .filter((s) => s.campaign_id === null || shown.has(s.campaign_id))
    .map((s) => ({
      id: s.id,
      first_name: s.fields.first_name,
      last_name: s.fields.last_name,
      when: s.created_at,
      detail: "inscription en ligne",
    }));

  const reviews = (reviewsRes.data ?? []) as unknown as {
    case_id: string;
    status: string;
    responded_at: string | null;
    cases: Named;
  }[];
  const changes = reviews
    .filter((r) => r.status === "changes_requested")
    .map((r) => ({ ...r.cases, when: r.responded_at, detail: "demande une modification" }));

  // Validés : seulement s'il reste des formations sans candidature envoyée
  const approvedReviews = reviews.filter((r) => r.status === "approved");
  const unreadIds = Object.keys(unread);
  const [programsRes, unreadRes] = await Promise.all([
    approvedReviews.length > 0
      ? supabase
          .from("case_programs")
          .select("case_id")
          .in("case_id", approvedReviews.map((r) => r.case_id))
          .eq("result", "none")
      : Promise.resolve({ data: [] as { case_id: string }[] }),
    unreadIds.length > 0
      ? supabase
          .from("cases")
          .select("id, first_name, last_name")
          .in("id", unreadIds.slice(0, 100))
          .eq("status", "active")
          .in("campaign_id", campaignIds)
      : Promise.resolve({ data: [] as Named[] }),
  ]);
  const toSend = new Map<string, number>();
  for (const p of (programsRes.data ?? []) as { case_id: string }[]) {
    toSend.set(p.case_id, (toSend.get(p.case_id) ?? 0) + 1);
  }
  const approved = approvedReviews
    .filter((r) => toSend.has(r.case_id))
    .map((r) => ({
      ...r.cases,
      when: r.responded_at,
      detail: plural(toSend.get(r.case_id)!, "formation à envoyer", "formations à envoyer"),
    }));

  // Une demande de modification arrive aussi comme message : pas deux fois
  const inChanges = new Set(changes.map((c) => c.id));
  const unreadList = ((unreadRes.data ?? []) as Named[])
    .filter((c) => !inChanges.has(c.id))
    .sort((a, b) => unread[b.id] - unread[a.id])
    .map((c) => ({
      ...c,
      when: null,
      detail: plural(unread[c.id], "message non lu", "messages non lus"),
    }));

  return { signups, changes, unread: unreadList, approved };
}

export type Results = {
  counts: Record<ProgramResult, number>;
  total: number;
  // Candidats qui ont au moins une formation acceptée
  admitted: number;
};

// Réponses des établissements, sur les dossiers non abandonnés
export async function loadResults(supabase: SupabaseClient, campaignIds: string[]): Promise<Results> {
  const scoped = (result: ProgramResult) =>
    supabase
      .from("case_programs")
      .select("id, cases!inner(campaign_id, status)", { count: "exact", head: true })
      .eq("result", result)
      .in("cases.campaign_id", campaignIds)
      .neq("cases.status", "abandoned");

  const [countRes, accepted] = await Promise.all([
    Promise.all(PROGRAM_RESULTS.map((r) => scoped(r))),
    readAll<{ case_id: string }>((from, to) =>
      supabase
        .from("case_programs")
        .select("id, case_id, cases!inner(campaign_id, status)")
        .eq("result", "accepted")
        .in("cases.campaign_id", campaignIds)
        .neq("cases.status", "abandoned")
        .order("id")
        .range(from, to),
    ).catch(() => {
      reportError("[dashboard results]", "admis");
      return [];
    }),
  ]);
  for (const r of countRes) if (r.error) reportError("[dashboard results]", r.error.code);
  const counts = Object.fromEntries(
    PROGRAM_RESULTS.map((r, i) => [r, countRes[i].count ?? 0]),
  ) as Record<ProgramResult, number>;
  return {
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
    admitted: new Set(accepted.map((p) => p.case_id)).size,
  };
}

export type ActivityEntry = ActivityGroup & {
  actor: { first_name: string; last_name: string } | null;
  // Objet de l'action : le dossier, sinon la campagne ou le membre visé
  object: { label: string; href: string | null } | null;
};

// Journal de l'agence (patron seulement, règle RLS), regroupé et nommé
export async function loadActivity(
  supabase: SupabaseClient,
  campaigns: { id: string; name: string }[],
  max = 6,
): Promise<ActivityEntry[]> {
  const { data } = await supabase
    .from("activity_log")
    .select("id, actor_id, action, target_type, target_id, case_id, created_at")
    .order("created_at", { ascending: false })
    .limit(60);
  const groups = groupActivity((data ?? []) as ActivityRow[], max);

  const caseIds = [...new Set(groups.flatMap((g) => (g.case_id ? [g.case_id] : [])))];
  const profileIds = [
    ...new Set(
      groups.flatMap((g) => [
        ...(g.actor_id ? [g.actor_id] : []),
        ...(g.target_type === "profile" && g.target_id ? [g.target_id] : []),
      ]),
    ),
  ];
  const [casesRes, profilesRes] = await Promise.all([
    caseIds.length > 0
      ? supabase.from("cases").select("id, first_name, last_name").in("id", caseIds)
      : Promise.resolve({ data: [] as Named[] }),
    profileIds.length > 0
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", profileIds)
      : Promise.resolve({ data: [] as Named[] }),
  ]);
  // Membres illisibles : auteur neutre, pas « ancien membre » (ce serait faux)
  const profilesFailed = "error" in profilesRes && profilesRes.error != null;
  if (profilesFailed) reportError("[dashboard activity]", profilesRes.error.code);
  const caseById = new Map(((casesRes.data ?? []) as Named[]).map((c) => [c.id, c]));
  const profileById = new Map(((profilesRes.data ?? []) as Named[]).map((p) => [p.id, p]));
  const campaignById = new Map(campaigns.map((c) => [c.id, c.name]));

  return groups.map((g) => {
    let object: ActivityEntry["object"] = null;
    const c = g.case_id ? caseById.get(g.case_id) : undefined;
    if (c) {
      object = { label: displayName(c.first_name, c.last_name), href: `/cases/${c.id}` };
    } else if (g.target_type === "campaign" && g.target_id && campaignById.has(g.target_id)) {
      object = { label: campaignById.get(g.target_id)!, href: `/campaigns/${g.target_id}` };
    } else if (g.target_type === "profile" && g.target_id && g.target_id !== g.actor_id) {
      const p = profileById.get(g.target_id);
      if (p) object = { label: fullName(p.first_name, p.last_name), href: "/team" };
    }
    const actor = !g.actor_id
      ? null
      : profilesFailed
        ? { first_name: "Un", last_name: "membre" }
        : (profileById.get(g.actor_id) ?? null);
    return { ...g, actor, object };
  });
}

// « Dossiers sans nouvelles » : seuil et nombre de dossiers listés
export const STALE_DAYS = 14;
const STALE_SHOWN = 6;

export type StaleCase = Named & { assigned_to: string | null; last_activity_at: string };
export type Stale = { rows: StaleCase[]; total: number };

// Dossiers actifs auxquels personne de l'agence n'a touché depuis STALE_DAYS
// jours (vue case_activity), les plus anciens d'abord
export async function loadStale(supabase: SupabaseClient, campaignIds: string[]): Promise<Stale> {
  const cutoff = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();
  const { data, count, error } = await supabase
    .from("case_activity")
    .select("id, first_name, last_name, assigned_to, last_activity_at", { count: "exact" })
    .in("campaign_id", campaignIds)
    .eq("status", "active")
    .lt("last_activity_at", cutoff)
    .order("last_activity_at", { ascending: true })
    .limit(STALE_SHOWN);
  if (error) reportError("[dashboard stale]", error.code);
  return { rows: (data ?? []) as StaleCase[], total: count ?? 0 };
}

export type CashMonth = { month: string; amount: number; payments: number };

// Encaissements des six derniers mois, mois en cours compris ; un mois sans
// paiement vaut zéro
export async function loadCashflow(
  supabase: SupabaseClient,
  campaignIds: string[],
  today: string,
): Promise<CashMonth[]> {
  const months = lastMonths(today, 6);
  const { data, error } = await supabase
    .from("payment_months")
    .select("month, amount, payments")
    .in("campaign_id", campaignIds)
    .gte("month", months[0]);
  if (error) reportError("[dashboard cashflow]", error.code);
  const rows = (data ?? []) as { month: string; amount: number | string; payments: number }[];
  return months.map((month) => {
    const inMonth = rows.filter((r) => r.month === month);
    return {
      month,
      amount: inMonth.reduce((n, r) => n + Number(r.amount), 0),
      payments: inMonth.reduce((n, r) => n + r.payments, 0),
    };
  });
}
