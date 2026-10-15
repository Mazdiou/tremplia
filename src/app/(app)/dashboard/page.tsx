import Link from "next/link";
import { CalendarClock, CalendarRange, MessagesSquare, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getShellUser } from "@/components/shell/app-shell";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { EmptyState } from "@/components/empty-state";
import {
  NewCaseLink,
  PageContainer,
  PageHeader,
  Panel,
  StatCard,
  StatusPill,
} from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { countdownLabel, nextDeadline } from "@/features/campaigns/timeline";
import { listCampaignDates, listCampaigns } from "@/features/campaigns/server/queries";
import { CampaignSelect } from "@/features/dashboard/components/campaign-select";
import { agencyUnreadCounts } from "@/features/messages/server/messages";
import { countCases, countCreatedLastWeek, sumStat } from "@/features/cases/case-stats";
import { listCaseStats } from "@/features/cases/server/case-stats";
import { UnreadBadge } from "@/features/messages/components/unread-badge";
import { activityActor, activityLabel } from "@/features/history/labels";
import {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  labelOf,
} from "@/features/cases/labels";
import { APP_TIMEZONE, dayFormat, formatLongDate, todayInAppTimezone } from "@/lib/dates";
import { displayName, initialsOf } from "@/lib/names";
import { formatDA } from "@/lib/money";
import { BRAND } from "@/config/brand";

const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const monthName = new Intl.DateTimeFormat("fr-FR", { timeZone: APP_TIMEZONE, month: "long" });
const longToday = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

// « aujourd'hui », « hier », « il y a 2 jours », puis la date
function relativeDay(iso: string) {
  const d = new Date(iso);
  const diff = Math.round(
    (Date.parse(todayInAppTimezone()) - Date.parse(todayInAppTimezone(d))) / 86_400_000,
  );
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  if (diff < 7) return `il y a ${diff} jours`;
  return dayFormat.format(d);
}

// Heure pour aujourd'hui, sinon jour relatif
function activityWhen(iso: string) {
  const diff = relativeDay(iso);
  return diff === "aujourd'hui" ? timeFmt.format(new Date(iso)) : diff;
}

function Initials({ first, last }: { first: string; last: string }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground"
    >
      {initialsOf(first, last)}
    </span>
  );
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  // Toutes les campagnes actives, ou celle choisie dans le sélecteur
  const [u, supabase, campaignList, { campaign: wanted }] = await Promise.all([
    getShellUser(),
    createClient(),
    listCampaigns(),
    searchParams,
  ]);
  const today = todayInAppTimezone();
  const todayLabel = longToday.format(new Date());
  // Abonnement expiré : pas de bouton de création (déjà en cache : coquille)
  const readOnly = await isReadOnly(u.member.agencyId);

  const allActive = campaignList.filter((c) => c.status === "active");
  const selected = allActive.find((c) => c.id === wanted) ?? null;
  const campaigns = selected ? [selected] : allActive;
  const ids = campaigns.map((c) => c.id);

  if (ids.length === 0) {
    return (
      <PageContainer width="narrow">
        <PageHeader title={`Bonjour ${u.member.firstName}`} subtitle={todayLabel} />
        <EmptyState
          icon={CalendarRange}
          title={`Bienvenue dans ${BRAND.name}`}
          description={
            u.member.isOwner
              ? "Commencez par créer une campagne ou importer un modèle (Campus France, par exemple) : vous pourrez ensuite y ajouter vos dossiers."
              : "Aucune campagne active pour le moment. Prévenez le patron : il doit créer une campagne avant que vous puissiez ajouter des dossiers."
          }
        />
        {u.member.isOwner && !readOnly && (
          <div className="flex justify-center gap-2">
            <Link href="/campaigns#modeles" className={buttonVariants({ variant: "outline" })}>
              Importer un modèle
            </Link>
            <Link href="/campaigns/new" className={buttonVariants()}>
              Créer une campagne
            </Link>
          </div>
        )}
      </PageContainer>
    );
  }

  // Lectures indépendantes, lancées ensemble. Tous les compteurs viennent
  // d'une seule lecture de la vue case_stats (via le RLS).
  // Paiements : chiffres réservés au patron, comme le journal
  const monthStart = `${today.slice(0, 7)}-01`;
  const [stats, unread, recentRes, activityRes, dates, monthRes, owingRes] = await Promise.all([
    listCaseStats(ids),
    // Dossiers dont le candidat a écrit sans réponse lue (toute l'agence)
    agencyUnreadCounts(u.member.agencyId),
    supabase
      .from("cases")
      .select("id, first_name, last_name, education_level, created_at")
      .in("campaign_id", ids)
      .order("created_at", { ascending: false })
      .limit(5),
    // Journal : lisible par le patron seulement (règle RLS)
    u.member.isOwner
      ? supabase
          .from("activity_log")
          .select("id, actor_id, action, created_at")
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: null }),
    listCampaignDates(campaigns),
    u.member.isOwner
      ? supabase
          .from("payment_months")
          .select("amount, payments")
          .in("campaign_id", ids)
          .eq("month", monthStart)
      : Promise.resolve({ data: null }),
    // Candidats qui doivent le plus (dossiers non abandonnés)
    u.member.isOwner
      ? supabase
          .from("cases")
          .select("id, first_name, last_name, remaining_amount")
          .in("campaign_id", ids)
          .neq("status", "abandoned")
          .gt("remaining_amount", 0)
          .order("remaining_amount", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
  ]);
  const recent = recentRes.data;
  const activity = activityRes.data;

  const unreadIds = Object.keys(unread);
  const actorIds = [
    ...new Set((activity ?? []).flatMap((a) => (a.actor_id ? [a.actor_id as string] : []))),
  ];
  // Noms : des dossiers avec messages non lus, et des auteurs du journal
  const [{ data: unreadCases }, { data: actors }] = await Promise.all([
    unreadIds.length > 0
      ? supabase.from("cases").select("id, first_name, last_name").in("id", unreadIds.slice(0, 50))
      : Promise.resolve({ data: [] }),
    actorIds.length > 0
      ? supabase.from("profiles").select("id, first_name, last_name").in("id", actorIds)
      : Promise.resolve({ data: [] }),
  ]);
  const unreadList = ((unreadCases ?? []) as { id: string; first_name: string; last_name: string }[])
    .map((c) => ({ ...c, count: unread[c.id] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const active = countCases(stats, { status: "active" });
  const mine = countCases(stats, { status: "active", assignedTo: u.member.userId });
  const week = countCreatedLastWeek(stats);
  const ended = countCases(stats, { status: ["closed", "abandoned"] });

  const monthRows = (monthRes.data ?? []) as { amount: number | string; payments: number }[];
  const collected = monthRows.reduce((n, r) => n + Number(r.amount), 0);
  const collectedCount = monthRows.reduce((n, r) => n + r.payments, 0);
  const remaining = sumStat(stats, "remaining");
  const owing = sumStat(stats, "owing");
  const feeUnset = sumStat(stats, "fee_unset");
  const topOwing = (owingRes.data ?? []) as {
    id: string;
    first_name: string;
    last_name: string;
    remaining_amount: number;
  }[];
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

  const actorById = new Map(
    (actors ?? []).map((a) => [a.id as string, a as { first_name: string; last_name: string }]),
  );

  const next = nextDeadline(dates, today);

  // Vue « toutes les campagnes » : une carte par campagne
  const cards =
    !selected && campaigns.length > 1
      ? campaigns.map((c) => ({
          ...c,
          activeCount: countCases(stats, { campaignId: c.id, status: "active" }),
          next: nextDeadline(dates.filter((d) => d.campaignId === c.id), today),
        }))
      : [];

  // Les niveaux sans dossier ne s'affichent que s'ils sont courants
  const levelRows = EDUCATION_LEVELS.map((l) => ({
    l,
    n: countCases(stats, { status: "active", educationLevel: l }),
  })).filter(
    (r) => r.n > 0 || ["terminale", "l1", "l2", "l3", "m1"].includes(r.l),
  );
  const maxLevel = Math.max(1, ...levelRows.map((r) => r.n));

  return (
    <PageContainer width="wide">
      <PageHeader
        title={`Bonjour ${u.member.firstName}`}
        subtitle={
          <span className="first-letter:uppercase">
            {todayLabel} ·{" "}
            {selected
              ? selected.name
              : campaigns.length > 1
                ? `${campaigns.length} campagnes actives`
                : campaigns[0].name}
          </span>
        }
        actions={
          <>
            {allActive.length > 1 && (
              <CampaignSelect campaigns={allActive} value={selected?.id ?? ""} />
            )}
            {!readOnly && <NewCaseLink campaignId={selected?.id} className="max-md:hidden" />}
          </>
        }
      />

      {cards.length > 0 && (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard?campaign=${c.id}`}
                className="group flex h-full flex-col rounded-2xl border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-highlight/40"
              >
                <span className="font-semibold group-hover:text-primary">{c.name}</span>
                <span className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  {c.activeCount} dossier{c.activeCount > 1 ? "s" : ""} actif
                  {c.activeCount > 1 ? "s" : ""}
                </span>
                <span className="mt-3 flex items-center gap-2 border-t pt-3 text-sm">
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {c.next ? (
                    <>
                      <span className="min-w-0 truncate">{c.next.label}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        {countdownLabel(c.next.days)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Aucune échéance à venir</span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {unreadList.length > 0 && (
        <section className="rounded-2xl border border-primary/30 bg-highlight p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <MessagesSquare className="size-4 text-primary" aria-hidden />
            Messages non lus
            <UnreadBadge count={Object.values(unread).reduce((a, b) => a + b, 0)} />
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {unreadList.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cases/${c.id}/messages`}
                  className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm transition-colors hover:border-primary/40"
                >
                  <Initials first={c.first_name} last={c.last_name} />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {displayName(c.first_name, c.last_name)}
                  </span>
                  <UnreadBadge count={c.count} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Dossiers actifs" value={active} />
        <StatCard label="Mes dossiers" value={mine} hint="actifs, dont je suis responsable" />
        <StatCard label="Ajoutés cette semaine" value={week} className="max-md:hidden" />
        <StatCard label="Clos ou abandonnés" value={ended} className="max-md:hidden" />
      </div>

      {u.member.isOwner && (
        <Panel
          title="Paiements"
          description={
            campaigns.length > 1
              ? "Toutes les campagnes actives · visible par le patron seulement."
              : "Visible par le patron seulement."
          }
          actions={<Wallet className="size-4 text-muted-foreground" aria-hidden />}
        >
          <div className="grid gap-5 px-5 py-4 lg:grid-cols-[1fr_1fr]">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground first-letter:uppercase">
                  Encaissé en {monthName.format(new Date())}
                </dt>
                <dd className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums">
                  {formatDA(collected)}
                </dd>
                <dd className="text-xs text-muted-foreground">
                  {plural(collectedCount, "paiement")}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Reste à encaisser</dt>
                <dd className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums">
                  {formatDA(remaining)}
                </dd>
                <dd className="text-xs text-muted-foreground">{plural(owing, "dossier")}</dd>
              </div>
              <div className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1">
                <dt className="text-sm text-muted-foreground">Montant à fixer</dt>
                <dd className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums">
                  {feeUnset}
                </dd>
                <dd className="text-xs text-muted-foreground">
                  dossier{feeUnset > 1 ? "s" : ""} actif{feeUnset > 1 ? "s" : ""} sans montant
                  convenu
                </dd>
              </div>
            </dl>
            <div className="min-w-0">
              <h3 className="text-xs font-medium text-muted-foreground">
                Restes à payer les plus élevés
              </h3>
              {topOwing.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Aucun candidat ne doit d&apos;argent à l&apos;agence.
                </p>
              ) : (
                <ul className="mt-1">
                  {topOwing.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/cases/${c.id}/payments`}
                        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {displayName(c.first_name, c.last_name)}
                        </span>
                        <StatusPill tone="warn">{formatDA(c.remaining_amount)}</StatusPill>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Panel>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-primary/30 bg-highlight p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" aria-hidden />
            Prochaine échéance
          </h2>
          {next ? (
            <>
              <p className="mt-4 text-4xl font-semibold tracking-tight text-primary tabular-nums">
                {countdownLabel(next.days)}
              </p>
              <p className="mt-2 font-medium">{next.label}</p>
              <p className="text-sm text-muted-foreground">
                {formatLongDate(next.date)}
                {campaigns.length > 1 ? ` · ${next.campaignName}` : ""}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Aucune échéance à venir.</p>
          )}
        </section>

        <Panel title="Dossiers actifs par niveau" className="max-md:hidden">
          <div className="space-y-3 px-5 py-4">
            {levelRows.map(({ l, n: v }) => (
              <div
                key={l}
                className="grid grid-cols-[6.5rem_1fr_1.5rem] items-center gap-3 text-sm"
              >
                <span className="truncate text-muted-foreground">{EDUCATION_LEVEL_LABELS[l]}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${v === 0 ? 0 : Math.max(6, (v / maxLevel) * 100)}%` }}
                  />
                </span>
                <span className="text-right font-medium tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Ajoutés récemment">
          {(recent ?? []).length === 0 ? (
            <p className="px-5 py-5 text-sm text-muted-foreground">
              Aucun dossier pour le moment.
            </p>
          ) : (
            <ul>
              {(recent ?? []).map((c) => (
                <li key={c.id} className="border-b last:border-b-0">
                  <Link
                    href={`/cases/${c.id}`}
                    className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-muted/50"
                  >
                    <Initials first={c.first_name} last={c.last_name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {displayName(c.first_name, c.last_name)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {labelOf(EDUCATION_LEVEL_LABELS, c.education_level)}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeDay(c.created_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {u.member.isOwner && (
        <Panel
          title="Activité récente de l'agence"
          description="Visible par le patron seulement."
          className="max-md:hidden"
        >
          {(activity ?? []).length === 0 ? (
            <p className="px-5 py-5 text-sm text-muted-foreground">
              Aucune activité enregistrée.
            </p>
          ) : (
            <ul>
              {(activity ?? []).map((a) => {
                const actor = a.actor_id ? actorById.get(a.actor_id as string) : undefined;
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 border-b px-5 py-2.5 text-sm last:border-b-0"
                  >
                    <Initials first={actor?.first_name ?? "?"} last={actor?.last_name ?? ""} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">
                        {activityActor(
                          a.action,
                          actor && `${actor.first_name} ${actor.last_name}`,
                          "agency",
                        )}
                      </span>{" "}
                      <span className="text-muted-foreground">
                        {activityLabel(a.action, "agency")}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {activityWhen(a.created_at)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}

      {!readOnly && <NewCaseLink campaignId={selected?.id} className="w-full md:hidden" />}
    </PageContainer>
  );
}
