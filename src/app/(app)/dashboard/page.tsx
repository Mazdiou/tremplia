import Link from "next/link";
import { CalendarClock, CalendarRange, Wallet } from "lucide-react";
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
import { countdownLabel, nextDeadline, timeline } from "@/features/campaigns/timeline";
import { listCampaignDates, listCampaigns } from "@/features/campaigns/server/queries";
import { CampaignSelect } from "@/features/dashboard/components/campaign-select";
import { ActivityPanel } from "@/features/dashboard/components/activity-panel";
import { Initials, relativeDay } from "@/features/dashboard/components/dashboard-ui";
import { DeadlinesPanel } from "@/features/dashboard/components/deadlines-panel";
import { ResultsPanel } from "@/features/dashboard/components/results-panel";
import { TodoPanel } from "@/features/dashboard/components/todo-panel";
import { loadActivity, loadResults, loadTodo } from "@/features/dashboard/server/dashboard";
import { agencyUnreadCounts } from "@/features/messages/server/messages";
import { countCases, countCreatedLastWeek, sumStat } from "@/features/cases/case-stats";
import { listCaseStats } from "@/features/cases/server/case-stats";
import { EDUCATION_LEVEL_LABELS, labelOf } from "@/features/cases/labels";
import { APP_TIMEZONE, todayInAppTimezone } from "@/lib/dates";
import { displayName } from "@/lib/names";
import { formatDA } from "@/lib/money";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";
import { InstallAppCard } from "@/features/pwa/components/install-app-card";
import { StagePipeline } from "@/features/stages/components/stage-pipeline";
import { MyTasksPanel } from "@/features/tasks/components/my-tasks-panel";
import { loadMyTasks, myTaskCounts } from "@/features/tasks/server/read";
import { plural, pluralWord } from "@/lib/plural";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tableau de bord" };

const monthName = new Intl.DateTimeFormat("fr-FR", { timeZone: APP_TIMEZONE, month: "long" });
const longToday = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

// Tableau de bord, de haut en bas : ce qui attend l'agence (« À traiter »),
// mes tâches, les chiffres clés (cliquables vers la liste filtrée), les campagnes, les
// paiements (patron), les échéances et les réponses des établissements,
// puis l'activité de l'agence (patron).
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
  // Abonnement expiré : pas de bouton de création. Lu en même temps que le
  // reste (déjà demandé par la coquille : même lecture, mise en cache).
  const readOnlyPromise = isReadOnly(u.member.agencyId);

  const allActive = campaignList.filter((c) => c.status === "active");
  const selected = allActive.find((c) => c.id === wanted) ?? null;
  const campaigns = selected ? [selected] : allActive;
  const ids = campaigns.map((c) => c.id);

  if (ids.length === 0) {
    const readOnly = await readOnlyPromise;
    return (
      <PageContainer width="narrow">
        <PageHeader title={`Bonjour ${u.member.firstName}`} subtitle={todayLabel} />
        <InstallAppCard appName={BRAND.name} />
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
  // Paiements et journal : réservés au patron
  const monthStart = `${today.slice(0, 7)}-01`;
  // Messages non lus : servent aussi à « À traiter »
  const unreadPromise = agencyUnreadCounts(u.member.agencyId);
  // Une seule campagne affichée : l'avancement de ses dossiers par étape
  const single = campaigns.length === 1 ? campaigns[0] : null;
  // Mes tâches : toutes les campagnes actives, quel que soit le choix du
  // sélecteur (les compteurs sont déjà lus par la coquille)
  const tasksPromise = Promise.all([
    loadMyTasks(u.member.userId, u.member.isOwner),
    myTaskCounts(u.member.userId),
  ]);
  const [readOnly, stats, todo, recentRes, dates, monthRes, owingRes, results, activity, stagesRes, stageStatsRes] =
    await Promise.all([
      readOnlyPromise,
      listCaseStats(ids),
      loadTodo(supabase, ids, unreadPromise),
      supabase
        .from("cases")
        .select("id, first_name, last_name, education_level, created_at")
        .in("campaign_id", ids)
        .order("created_at", { ascending: false })
        .limit(5),
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
      loadResults(supabase, ids),
      u.member.isOwner ? loadActivity(supabase, campaignList) : Promise.resolve([]),
      single
        ? supabase.from("campaign_stages").select("id, name").eq("campaign_id", single.id).order("position")
        : Promise.resolve({ data: null }),
      single
        ? supabase
            .from("case_stage_stats")
            .select("stage_id, cases")
            .eq("campaign_id", single.id)
            .eq("status", "active")
        : Promise.resolve({ data: null }),
    ]);
  const recent = recentRes.data;
  const [myTasks, myCounts] = await tasksPromise;

  const active = countCases(stats, { status: "active" });
  const mine = countCases(stats, { status: "active", assignedTo: u.member.userId });
  const week = countCreatedLastWeek(stats);

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

  // Liens vers l'arbre des dossiers, filtré (et limité à la campagne choisie)
  const casesLink = (filtre?: string) => {
    const q = new URLSearchParams();
    if (filtre) q.set("filtre", filtre);
    if (selected) q.set("campagne", selected.id);
    const query = q.toString();
    return query ? `/cases?${query}` : "/cases";
  };

  // Plusieurs campagnes : une carte chacune, avec sa prochaine échéance.
  // Une seule : le bloc des prochaines échéances.
  const cards =
    campaigns.length > 1
      ? campaigns.map((c) => ({
          ...c,
          activeCount: countCases(stats, { campaignId: c.id, status: "active" }),
          next: nextDeadline(dates.filter((d) => d.campaignId === c.id), today),
        }))
      : [];
  const activeByStage = new Map(
    ((stageStatsRes.data ?? []) as { stage_id: string | null; cases: number }[]).map((r) => [
      r.stage_id,
      r.cases,
    ]),
  );
  const pipeline = ((stagesRes.data ?? []) as { id: string; name: string }[]).map((st) => ({
    ...st,
    activeCases: activeByStage.get(st.id) ?? 0,
  }));

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
            {/* Téléphone aussi : l'action la plus fréquente, sous le bonjour */}
            {!readOnly && <NewCaseLink campaignId={selected?.id} />}
          </>
        }
      />
      <InstallAppCard appName={BRAND.name} />

      <TodoPanel todo={todo} />
      <MyTasksPanel
        rows={myTasks.rows}
        counts={myCounts}
        teamOverdue={myTasks.teamOverdue}
        today={today}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Dossiers actifs" value={active} href={casesLink()} />
        <StatCard
          label="Mes dossiers"
          value={mine}
          hint="actifs, dont je suis responsable"
          href={casesLink("mes-dossiers")}
        />
        <StatCard label="Ajoutés cette semaine" value={week} className="max-md:hidden" />
        <StatCard
          label="Candidats admis"
          value={results.admitted}
          hint="au moins une formation acceptée"
          className="max-md:hidden"
        />
      </div>

      {single && <StagePipeline campaignId={single.id} stages={pipeline} />}

      {cards.length > 0 && (
        <ul className={cn("grid gap-4 md:grid-cols-2", cards.length > 2 && "xl:grid-cols-3")}>
          {cards.map((c) => (
            <li key={c.id}>
              <Link
                href={`/dashboard?campaign=${c.id}`}
                className="group flex h-full flex-col rounded-2xl border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-highlight/40"
              >
                <span className="font-semibold group-hover:text-link">{c.name}</span>
                <span className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  {plural(c.activeCount, "dossier actif", "dossiers actifs")}
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
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              <PaymentFigure
                label={`Encaissé en ${monthName.format(new Date())}`}
                value={formatDA(collected)}
                hint={plural(collectedCount, "paiement")}
              />
              <PaymentFigure
                label="Reste à encaisser"
                value={formatDA(remaining)}
                hint={plural(owing, "dossier")}
                href={owing > 0 ? casesLink("reste-a-payer") : undefined}
              />
              <PaymentFigure
                label="Montant à fixer"
                value={String(feeUnset)}
                hint={`${pluralWord(feeUnset, "dossier actif", "dossiers actifs")} sans montant convenu`}
                href={feeUnset > 0 ? casesLink("montant-a-fixer") : undefined}
                className="col-span-2 sm:col-span-1 lg:col-span-2 xl:col-span-1"
              />
            </div>
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

      <div className={cn("grid items-start gap-5", single ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
        {single && (
          <DeadlinesPanel
            campaignId={single.id}
            items={timeline(
              dates.filter((d) => d.campaignId === single.id),
              today,
            )}
          />
        )}
        <ResultsPanel results={results} />
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

      {u.member.isOwner && <ActivityPanel entries={activity} />}

    </PageContainer>
  );
}

// Chiffre du bloc Paiements ; avec `href`, il mène aux dossiers concernés
function PaymentFigure({
  label,
  value,
  hint,
  href,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground first-letter:uppercase">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </>
  );
  return href ? (
    <Link
      href={href}
      className={cn("-m-2 block rounded-lg p-2 transition-colors hover:bg-muted/60", className)}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
