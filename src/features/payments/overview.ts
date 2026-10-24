import { formatShortDate, isIsoDate } from "@/lib/dates";
import type { Sheet } from "@/lib/xlsx";
import { PAYMENT_METHODS, paymentMethodLabel } from "./schemas";

// Page Paiements (patron et membres autorisés) : tous les paiements de
// l'agence, en deux vues. Encaissements : ce qui est entré sur une période,
// avec les totaux par moyen de paiement (la caisse du jour, de la semaine,
// du mois…). Restes à payer : les candidats qui doivent encore de l'argent
// (dossiers non abandonnés), pour savoir qui relancer.
// Les filtres vivent dans l'adresse de la page : un lien ou un export
// reprend exactement ce qui est affiché.

export type OverviewView = "encaissements" | "restes";

export const PERIODS = [
  ["aujourdhui", "Aujourd'hui"],
  ["semaine", "Cette semaine"],
  ["mois", "Ce mois-ci"],
  ["mois-dernier", "Le mois dernier"],
  ["annee", "Cette année"],
  ["tout", "Depuis le début"],
  ["dates", "Dates au choix"],
] as const;
export type PeriodKey = (typeof PERIODS)[number][0];

export const BALANCE_SORTS = [
  ["reste", "Reste le plus élevé"],
  ["ancien", "Sans paiement depuis longtemps"],
  ["nom", "Nom"],
] as const;
export type BalanceSort = (typeof BALANCE_SORTS)[number][0];

export type OverviewFilters = {
  view: OverviewView;
  // "" : campagnes actives ; "toutes" ; ou l'identifiant d'une campagne
  campaign: string;
  // Encaissements
  period: PeriodKey;
  from: string; // AAAA-MM-JJ, période « dates » seulement
  to: string;
  method: string; // "" : tous
  recordedBy: string; // "" : toute l'équipe
  // Restes à payer
  responsible: string; // "" : tous ; "aucun" : sans responsable
  sort: BalanceSort;
};

type RawParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const isOneOf = <T extends string>(list: readonly (readonly [T, string])[], v: string): v is T =>
  list.some(([key]) => key === v);

// Valeurs de l'adresse, ramenées à des valeurs connues (une valeur inconnue
// reprend la valeur par défaut au lieu de faire planter la page)
export function parseOverviewFilters(
  params: RawParams,
  known: { campaignIds: string[]; memberIds: string[] },
): OverviewFilters {
  const campaign = one(params.campagne);
  const period = one(params.periode);
  const method = one(params.moyen);
  const recordedBy = one(params.par);
  const responsible = one(params.responsable);
  const sort = one(params.tri);
  let from = one(params.du);
  let to = one(params.au);
  const datesOk = period === "dates" && isIsoDate(from) && isIsoDate(to);
  if (datesOk && from > to) [from, to] = [to, from];

  return {
    view: one(params.vue) === "restes" ? "restes" : "encaissements",
    campaign: campaign === "toutes" || known.campaignIds.includes(campaign) ? campaign : "",
    period: isOneOf(PERIODS, period) && (period !== "dates" || datesOk) ? period : "mois",
    from: datesOk ? from : "",
    to: datesOk ? to : "",
    method: (PAYMENT_METHODS as readonly string[]).includes(method) ? method : "",
    recordedBy: known.memberIds.includes(recordedBy) ? recordedBy : "",
    responsible:
      responsible === "aucun" || known.memberIds.includes(responsible) ? responsible : "",
    sort: isOneOf(BALANCE_SORTS, sort) ? sort : "reste",
  };
}

// Adresse de la page (ou de l'export) pour ces filtres : seuls les filtres
// de la vue affichée, et seulement s'ils ne sont pas à leur valeur par défaut
export function overviewQuery(f: OverviewFilters): string {
  const q = new URLSearchParams();
  if (f.view === "restes") q.set("vue", "restes");
  if (f.campaign) q.set("campagne", f.campaign);
  if (f.view === "encaissements") {
    if (f.period !== "mois") q.set("periode", f.period);
    if (f.period === "dates") {
      q.set("du", f.from);
      q.set("au", f.to);
    }
    if (f.method) q.set("moyen", f.method);
    if (f.recordedBy) q.set("par", f.recordedBy);
  } else {
    if (f.responsible) q.set("responsable", f.responsible);
    if (f.sort !== "reste") q.set("tri", f.sort);
  }
  return q.toString();
}

// Période

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

function shiftDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function monthLabel(iso: string) {
  const label = `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
  return label[0].toUpperCase() + label.slice(1);
}

// Dates couvertes (incluses ; null : sans limite) et libellé de la période.
// La semaine commence le lundi.
export function periodRange(
  f: Pick<OverviewFilters, "period" | "from" | "to">,
  today: string,
): { from: string | null; to: string | null; label: string } {
  const monthStart = `${today.slice(0, 7)}-01`;
  switch (f.period) {
    case "aujourdhui":
      return { from: today, to: today, label: "Aujourd'hui" };
    case "semaine": {
      const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7; // lundi = 0
      return { from: shiftDays(today, -weekday), to: today, label: "Cette semaine" };
    }
    case "mois-dernier": {
      const lastDay = shiftDays(monthStart, -1);
      const first = `${lastDay.slice(0, 7)}-01`;
      return { from: first, to: lastDay, label: monthLabel(first) };
    }
    case "annee":
      return { from: `${today.slice(0, 4)}-01-01`, to: today, label: `Année ${today.slice(0, 4)}` };
    case "tout":
      return { from: null, to: null, label: "Depuis le début" };
    case "dates":
      return {
        from: f.from,
        to: f.to,
        label:
          f.from === f.to
            ? `Le ${formatShortDate(f.from)}`
            : `Du ${formatShortDate(f.from)} au ${formatShortDate(f.to)}`,
      };
    default:
      return { from: monthStart, to: today, label: monthLabel(monthStart) };
  }
}

// Lignes

export type CollectionRow = {
  id: string;
  caseId: string;
  candidate: string;
  campaign: string;
  amount: number;
  paidOn: string;
  method: string;
  note: string | null;
  recordedBy: string;
  // Paiement annulé : affiché barré, hors des totaux
  cancelReason: string | null;
};

export type BalanceRow = {
  caseId: string;
  candidate: string;
  firstName: string;
  phone: string | null;
  campaign: string;
  responsible: string | null;
  agreed: number;
  paid: number;
  remaining: number;
  // Dernier paiement non annulé (null : rien payé)
  lastPaidOn: string | null;
};

export type MethodTotal = { method: string; label: string; amount: number; count: number };

// Totaux des encaissements : les annulés sont comptés à part. Les moyens
// proposés aujourd'hui apparaissent toujours (même à 0) ; un ancien moyen,
// seulement s'il a servi.
export function collectionTotals(rows: Pick<CollectionRow, "amount" | "method" | "cancelReason">[]) {
  const byMethod = new Map<string, MethodTotal>(
    PAYMENT_METHODS.map((m) => [m, { method: m, label: paymentMethodLabel(m), amount: 0, count: 0 }]),
  );
  let total = 0;
  let count = 0;
  let cancelledCount = 0;
  for (const r of rows) {
    if (r.cancelReason !== null) {
      cancelledCount += 1;
      continue;
    }
    total += r.amount;
    count += 1;
    const t = byMethod.get(r.method) ?? {
      method: r.method,
      label: paymentMethodLabel(r.method),
      amount: 0,
      count: 0,
    };
    t.amount += r.amount;
    t.count += 1;
    byMethod.set(r.method, t);
  }
  return { total, count, cancelledCount, byMethod: [...byMethod.values()] };
}

// Encaissements regroupés par jour (du plus récent au plus ancien, ordre de
// la lecture conservé), avec le total du jour hors annulés
export function groupByDay(rows: CollectionRow[]) {
  const days: { day: string; total: number; rows: CollectionRow[] }[] = [];
  for (const r of rows) {
    let last = days.at(-1);
    if (!last || last.day !== r.paidOn) {
      last = { day: r.paidOn, total: 0, rows: [] };
      days.push(last);
    }
    last.rows.push(r);
    if (r.cancelReason === null) last.total += r.amount;
  }
  return days;
}

// Jours affichés : des jours entiers (leur total reste juste) jusqu'à
// `max` lignes environ ; le premier jour est toujours affiché
export function firstDays(days: ReturnType<typeof groupByDay>, max: number) {
  const shown: typeof days = [];
  let rows = 0;
  for (const d of days) {
    if (shown.length > 0 && rows + d.rows.length > max) break;
    shown.push(d);
    rows += d.rows.length;
  }
  return { days: shown, rows };
}

const byCandidate = (a: BalanceRow, b: BalanceRow) =>
  a.candidate.localeCompare(b.candidate, "fr", { sensitivity: "base" });

// « ancien » : ceux qui n'ont jamais rien payé d'abord, puis du dernier
// paiement le plus ancien au plus récent ; à égalité, le reste le plus élevé
export function sortBalances(rows: BalanceRow[], sort: BalanceSort): BalanceRow[] {
  const list = [...rows];
  if (sort === "nom") return list.sort(byCandidate);
  if (sort === "ancien") {
    return list.sort(
      (a, b) =>
        (a.lastPaidOn ?? "").localeCompare(b.lastPaidOn ?? "") ||
        b.remaining - a.remaining ||
        byCandidate(a, b),
    );
  }
  return list.sort((a, b) => b.remaining - a.remaining || byCandidate(a, b));
}

export function balanceTotals(rows: BalanceRow[]) {
  return {
    remaining: rows.reduce((n, r) => n + r.remaining, 0),
    cases: rows.length,
    neverPaid: rows.filter((r) => r.paid === 0).length,
  };
}

// Export Excel

export function collectionsSheet(rows: CollectionRow[]): Sheet {
  return {
    name: "Encaissements",
    columns: [
      { header: "Date", width: 12, kind: "date" },
      { header: "Candidat", width: 24 },
      { header: "Campagne", width: 22 },
      { header: "Montant", width: 14, kind: "amount" },
      { header: "Moyen", width: 20 },
      { header: "Enregistré par", width: 20 },
      { header: "Note", width: 30 },
      { header: "Annulé", width: 9 },
      { header: "Motif d'annulation", width: 30 },
    ],
    rows: rows.map((r) => [
      r.paidOn,
      r.candidate,
      r.campaign,
      r.amount,
      paymentMethodLabel(r.method),
      r.recordedBy,
      r.note,
      r.cancelReason === null ? "Non" : "Oui",
      r.cancelReason,
    ]),
  };
}

export function balancesSheet(rows: BalanceRow[]): Sheet {
  return {
    name: "Restes à payer",
    columns: [
      { header: "Candidat", width: 24 },
      { header: "Téléphone", width: 15 },
      { header: "Campagne", width: 22 },
      { header: "Responsable", width: 20 },
      { header: "Montant convenu", width: 15, kind: "amount" },
      { header: "Payé", width: 14, kind: "amount" },
      { header: "Reste à payer", width: 14, kind: "amount" },
      { header: "Dernier paiement", width: 14, kind: "date" },
    ],
    rows: rows.map((r) => [
      r.candidate,
      r.phone,
      r.campaign,
      r.responsible,
      r.agreed,
      r.paid,
      r.remaining,
      r.lastPaidOn,
    ]),
  };
}

// « Encaissements - Octobre 2026.xlsx », « Restes à payer - 20-10-2026.xlsx »
export function overviewFileName(view: OverviewView, periodLabel: string, today: string) {
  const date = today.split("-").reverse().join("-");
  const label =
    view === "restes"
      ? `Restes à payer - ${date}`
      : `Encaissements - ${periodLabel.replace(/\//g, "-")}`;
  return `${label.replace(/[\\/:*?"<>|]/g, " ").trim()}.xlsx`;
}
