import "server-only";
import { listCampaigns, type CampaignSummary } from "@/features/campaigns/server/queries";
import { listTaskMembers } from "@/features/tasks/server/read";
import type { TaskMember } from "@/features/tasks/types";
import { todayInAppTimezone } from "@/lib/dates";
import { displayName, fullName } from "@/lib/names";
import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/supabase/read-all";
import {
  parseOverviewFilters,
  periodRange,
  sortBalances,
  type BalanceRow,
  type CollectionRow,
  type OverviewFilters,
} from "../overview";

// Lectures de la page Paiements et de son export, via le RLS : seuls les
// dossiers et paiements de l'agence de la session reviennent. Le contrôle
// « patron seulement » est fait par la page et par la route d'export.

type Person = { first_name: string; last_name: string };

export type PaymentsOverview = {
  filters: OverviewFilters;
  today: string;
  period: ReturnType<typeof periodRange>;
  campaigns: CampaignSummary[];
  members: TaskMember[];
  // Aucune campagne dans le périmètre choisi : rien à lire
  noCampaign: boolean;
  collections: CollectionRow[] | null;
  balances: BalanceRow[] | null;
};

export async function loadPaymentsOverview(
  params: Record<string, string | string[] | undefined>,
): Promise<PaymentsOverview> {
  const [campaigns, members] = await Promise.all([listCampaigns(), listTaskMembers()]);
  const filters = parseOverviewFilters(params, {
    campaignIds: campaigns.map((c) => c.id),
    memberIds: members.map((m) => m.id),
  });
  const today = todayInAppTimezone();
  const period = periodRange(filters, today);

  const scope = campaigns.filter((c) =>
    filters.campaign === "toutes"
      ? true
      : filters.campaign
        ? c.id === filters.campaign
        : c.status === "active",
  );
  const base = { filters, today, period, campaigns, members, noCampaign: scope.length === 0 };
  if (scope.length === 0) return { ...base, collections: [], balances: [] };

  const ids = scope.map((c) => c.id);
  // Nom de campagne affiché sur chaque ligne (archivée : précisé)
  const campaignName = new Map(
    campaigns.map((c) => [c.id, c.status === "archived" ? `${c.name} (archivée)` : c.name]),
  );
  const memberName = new Map(members.map((m) => [m.id, m.name]));

  if (filters.view === "encaissements") {
    return { ...base, collections: await readCollections(filters, period, ids, campaignName), balances: null };
  }
  return { ...base, collections: null, balances: await readBalances(filters, ids, campaignName, memberName) };
}

// Paiements de la période, du plus récent au plus ancien (annulés compris)
async function readCollections(
  f: OverviewFilters,
  period: { from: string | null; to: string | null },
  campaignIds: string[],
  campaignName: Map<string, string>,
): Promise<CollectionRow[]> {
  const supabase = await createClient();
  type Row = {
    id: string;
    case_id: string;
    amount: number;
    paid_on: string;
    method: string;
    note: string | null;
    cancel_reason: string | null;
    cancelled_at: string | null;
    author: Person | null;
    case: Person & { campaign_id: string };
  };
  const rows = await readAll<Row>((from, to) => {
    let q = supabase
      .from("case_payments")
      .select(
        `id, case_id, amount, paid_on, method, note, cancelled_at, cancel_reason,
        author:profiles!case_payments_created_by_fk(first_name, last_name),
        case:cases!inner(first_name, last_name, campaign_id)`,
      )
      .in("case.campaign_id", campaignIds);
    if (period.from) q = q.gte("paid_on", period.from);
    if (period.to) q = q.lte("paid_on", period.to);
    if (f.method) q = q.eq("method", f.method);
    if (f.recordedBy) q = q.eq("created_by", f.recordedBy);
    return q
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
  });

  return rows.map((r) => ({
    id: r.id,
    caseId: r.case_id,
    candidate: displayName(r.case.first_name, r.case.last_name),
    campaign: campaignName.get(r.case.campaign_id) ?? "",
    amount: r.amount,
    paidOn: r.paid_on,
    method: r.method,
    note: r.note,
    recordedBy: r.author ? fullName(r.author.first_name, r.author.last_name) : "Un ancien membre",
    cancelReason: r.cancelled_at ? (r.cancel_reason ?? "") : null,
  }));
}

// Candidats qui doivent encore de l'argent, dossiers abandonnés exclus (même
// règle que le tableau de bord), avec la date de leur dernier paiement
async function readBalances(
  f: OverviewFilters,
  campaignIds: string[],
  campaignName: Map<string, string>,
  memberName: Map<string, string>,
): Promise<BalanceRow[]> {
  const supabase = await createClient();
  type CaseRow = Person & {
    id: string;
    phone: string | null;
    campaign_id: string;
    assigned_to: string | null;
    agreed_amount: number;
    paid_amount: number;
    remaining_amount: number;
  };
  const [cases, payments] = await Promise.all([
    readAll<CaseRow>((from, to) => {
      let q = supabase
        .from("cases")
        .select(
          "id, first_name, last_name, phone, campaign_id, assigned_to, agreed_amount, paid_amount, remaining_amount",
        )
        .in("campaign_id", campaignIds)
        .neq("status", "abandoned")
        .gt("remaining_amount", 0);
      if (f.responsible === "aucun") q = q.is("assigned_to", null);
      else if (f.responsible) q = q.eq("assigned_to", f.responsible);
      return q.order("id").range(from, to);
    }),
    // Dates des paiements de ces mêmes dossiers (filtre sur le dossier joint)
    readAll<{ case_id: string; paid_on: string }>((from, to) =>
      supabase
        .from("case_payments")
        .select("case_id, paid_on, case:cases!inner(campaign_id)")
        .in("case.campaign_id", campaignIds)
        .gt("case.remaining_amount", 0)
        .is("cancelled_at", null)
        .order("id")
        .range(from, to),
    ),
  ]);

  const lastPaid = new Map<string, string>();
  for (const p of payments) {
    const current = lastPaid.get(p.case_id);
    if (!current || p.paid_on > current) lastPaid.set(p.case_id, p.paid_on);
  }

  return sortBalances(
    cases.map((c) => ({
      caseId: c.id,
      candidate: displayName(c.first_name, c.last_name),
      firstName: c.first_name,
      phone: c.phone,
      campaign: campaignName.get(c.campaign_id) ?? "",
      responsible: c.assigned_to ? (memberName.get(c.assigned_to) ?? null) : null,
      agreed: c.agreed_amount,
      paid: c.paid_amount,
      remaining: c.remaining_amount,
      lastPaidOn: lastPaid.get(c.id) ?? null,
    })),
    f.sort,
  );
}
