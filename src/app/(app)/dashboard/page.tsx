import Link from "next/link";
import { CalendarClock, CalendarRange, Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getShellUser } from "@/components/shell/app-shell";
import { getSubscription, isReadOnly } from "@/features/subscription/server/subscription";
import { daysLeft } from "@/features/subscription/subscription";
import { EmptyState } from "@/components/empty-state";
import {
  NewCaseLink,
  PageContainer,
  PageHeader,
  Panel,
  PanelLink,
  StatCard,
  StatusPill,
} from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { countdownLabel, nextDeadline, timeline } from "@/features/campaigns/timeline";
import { listCampaignDates, listCampaigns } from "@/features/campaigns/server/queries";
import { CampaignSelect } from "@/features/dashboard/components/campaign-select";
import { ActivityPanel } from "@/features/dashboard/components/activity-panel";
import { CashflowPanel } from "@/features/dashboard/components/cashflow-panel";
import { StalePanel } from "@/features/dashboard/components/stale-panel";
import { TeamOverduePanel } from "@/features/dashboard/components/team-overdue-panel";
import { DeadlinesPanel } from "@/features/dashboard/components/deadlines-panel";
import { ResultsPanel } from "@/features/dashboard/components/results-panel";
import { TodoPanel } from "@/features/dashboard/components/todo-panel";
import {
  loadActivity,
  loadCashflow,
  loadResults,
  loadStale,
  loadTodo,
} from "@/features/dashboard/server/dashboard";
import { CustomizeButton, DashboardWidgets, type WidgetEntry } from "@/features/dashboard/components/dashboard-widgets";
import { getDashboardLayouts } from "@/features/dashboard/server/layout";
import { WIDGETS, WIDGET_IDS, allowedWidget, applicableWidget, type WidgetDef, type WidgetId } from "@/features/dashboard/widgets";
import { agencyUnreadCounts } from "@/features/messages/server/messages";
import { countCases, countCreatedLastWeek, sumStat } from "@/features/cases/case-stats";
import { listCaseStats } from "@/features/cases/server/case-stats";
import { APP_TIMEZONE, todayInAppTimezone } from "@/lib/dates";
import { displayName } from "@/lib/names";
import { formatDA } from "@/lib/money";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";
import { InstallAppCard } from "@/features/pwa/components/install-app-card";
import { StagePipeline } from "@/features/stages/components/stage-pipeline";
import { MyTasksPanel } from "@/features/tasks/components/my-tasks-panel";
import {
  listTaskMembers,
  loadMyTasks,
  loadTeamOverdue,
  myTaskCounts,
} from "@/features/tasks/server/read";
import { OnboardingChecklist } from "@/features/onboarding/components/onboarding-checklist";
import { WelcomeDialog } from "@/features/onboarding/components/welcome-dialog";
import { loadOnboarding, needsWelcome } from "@/features/onboarding/server/onboarding";
import type { Member } from "@/lib/auth/require-member";
import { plural, pluralWord } from "@/lib/plural";
import { can } from "@/lib/permissions";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tableau de bord" };

const monthName = new Intl.DateTimeFormat("fr-FR", { timeZone: APP_TIMEZONE, month: "long" });
const longToday = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

// Tableau de bord : le bonjour et le guide de démarrage, puis les widgets
// dans la disposition du membre (voir features/dashboard/widgets.ts). Par
// défaut : ce qui attend l'agence (« À traiter »), mes tâches, les chiffres
// clés (cliquables vers la liste filtrée), l'avancement ou les campagnes, les
// dossiers sans nouvelles, les échéances, les paiements et les encaissements,
// les retards de l'équipe, les réponses des établissements, puis l'activité.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  // Toutes les campagnes actives, ou celle choisie dans le sélecteur
  const userPromise = getShellUser();
  const [u, supabase, campaignList, { campaign: wanted }, layouts] = await Promise.all([
    userPromise,
    createClient(),
    listCampaigns(),
    searchParams,
    userPromise.then((user) => getDashboardLayouts(user.member)),
  ]);
  const today = todayInAppTimezone();
  const todayLabel = longToday.format(new Date());
  // Abonnement expiré : pas de bouton de création. Lu en même temps que le
  // reste (déjà demandé par la coquille : même lecture, mise en cache).
  const readOnlyPromise = isReadOnly(u.member.agencyId);
  // Mot de bienvenue et guide « Bien démarrer » (nouvelle agence)
  const guidePromise = loadGuide(u.member, readOnlyPromise);

  const allActive = campaignList.filter((c) => c.status === "active");
  const selected = allActive.find((c) => c.id === wanted) ?? null;
  const campaigns = selected ? [selected] : allActive;
  const ids = campaigns.map((c) => c.id);

  if (ids.length === 0) {
    const [readOnly, guide] = await Promise.all([readOnlyPromise, guidePromise]);
    return (
      <PageContainer width="narrow">
        <PageHeader title={`Bonjour ${u.member.firstName}`} subtitle={todayLabel} />
        {guide.welcome}
        {/* Le guide, quand il est affiché, remplace l'écran vide */}
        {guide.checklist}
        <InstallAppCard appName={BRAND.name} />
        {!guide.checklist && (
          <EmptyState
            icon={CalendarRange}
            title={`Bienvenue dans ${BRAND.name}`}
            description={
              u.member.isOwner
                ? "Commencez par créer une campagne ou importer un modèle (Campus France, par exemple) : vous pourrez ensuite y ajouter vos dossiers."
                : "Aucune campagne active pour le moment. Prévenez le patron : il doit créer une campagne avant que vous puissiez ajouter des dossiers."
            }
          />
        )}
        {u.member.isOwner && !readOnly && !guide.checklist && (
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

  // Widgets que le membre a le droit de voir, et ceux de sa disposition qui
  // ont un sens ici (une ou plusieurs campagnes) : seuls ces derniers sont lus
  const seesPayments = can(u.member, "payments_view");
  const rights = { isOwner: u.member.isOwner, seesPayments };
  const allowed = WIDGET_IDS.filter((id) => allowedWidget(id, rights));
  const shown = new Set(
    layouts.layout
      .map((item) => item.id)
      .filter((id) => allowedWidget(id, rights) && applicableWidget(id, campaigns.length)),
  );
  const needs = (...wanted: WidgetId[]) => wanted.some((id) => shown.has(id));

  // Lectures indépendantes, lancées ensemble. Tous les compteurs viennent
  // d'une seule lecture de la vue case_stats (via le RLS).
  const monthStart = `${today.slice(0, 7)}-01`;
  // Une seule campagne affichée : l'avancement de ses dossiers par étape
  const single = campaigns.length === 1 ? campaigns[0] : null;
  // Mes tâches : toutes les campagnes actives, quel que soit le choix du
  // sélecteur (les compteurs sont déjà lus par la coquille)
  const tasksPromise = needs("tasks")
    ? Promise.all([
        // Retards de l'équipe : déjà dans leur propre widget s'il est affiché
        loadMyTasks(u.member.userId, u.member.isOwner && !needs("teamTasks")),
        myTaskCounts(u.member.userId),
      ])
    : null;
  // Dossiers sans nouvelles, encaissements par mois, retards de l'équipe (et
  // noms des membres pour les deux listes)
  const morePromise = Promise.all([
    needs("stale") ? loadStale(supabase, ids) : null,
    needs("cashflow") ? loadCashflow(supabase, ids, today) : null,
    needs("teamTasks") ? loadTeamOverdue() : null,
    needs("stale", "teamTasks") ? listTaskMembers() : [],
  ]);
  const none = Promise.resolve(null);
  const noRows = Promise.resolve({ data: null });
  const [readOnly, stats, todo, dates, monthRes, owingRes, results, activity, stagesRes, stageStatsRes] =
    await Promise.all([
      readOnlyPromise,
      needs("stats", "campaigns", "payments") ? listCaseStats(ids) : Promise.resolve([]),
      needs("todo")
        ? loadTodo(supabase, ids, agencyUnreadCounts(u.member.agencyId))
        : none,
      needs("campaigns", "deadlines") ? listCampaignDates(campaigns) : Promise.resolve([]),
      needs("payments")
        ? supabase
            .from("payment_months")
            .select("amount, payments")
            .in("campaign_id", ids)
            .eq("month", monthStart)
        : noRows,
      // Candidats qui doivent le plus (dossiers non abandonnés)
      needs("payments")
        ? supabase
            .from("cases")
            .select("id, first_name, last_name, remaining_amount")
            .in("campaign_id", ids)
            .neq("status", "abandoned")
            .gt("remaining_amount", 0)
            .order("remaining_amount", { ascending: false })
            .limit(5)
        : noRows,
      needs("results", "stats") ? loadResults(supabase, ids) : none,
      needs("activity") ? loadActivity(supabase, campaignList) : Promise.resolve([]),
      needs("pipeline") && single
        ? supabase.from("campaign_stages").select("id, name").eq("campaign_id", single.id).order("position")
        : noRows,
      needs("pipeline") && single
        ? supabase
            .from("case_stage_stats")
            .select("stage_id, cases")
            .eq("campaign_id", single.id)
            .eq("status", "active")
        : noRows,
    ]);
  const [myTasks, guide, [stale, cashflow, teamOverdue, members]] = await Promise.all([
    tasksPromise,
    guidePromise,
    morePromise,
  ]);
  const memberNames = new Map(members.map((m) => [m.id, m.name]));

  // Liens vers l'arbre des dossiers, filtré (et limité à la campagne choisie)
  const casesLink = (filtre?: string) => {
    const q = new URLSearchParams();
    if (filtre) q.set("filtre", filtre);
    if (selected) q.set("campagne", selected.id);
    const query = q.toString();
    return query ? `/cases?${query}` : "/cases";
  };
  // Liens vers la page Paiements (même campagne)
  const paymentsLink = (params: Record<string, string> = {}) => {
    const q = new URLSearchParams(params);
    if (selected) q.set("campagne", selected.id);
    const query = q.toString();
    return query ? `/payments?${query}` : "/payments";
  };

  // Contenu de chaque widget affiché
  const render: Record<WidgetId, () => React.ReactNode> = {
    todo: () => <TodoPanel todo={todo!} />,

    tasks: () => (
      <MyTasksPanel
        rows={myTasks![0].rows}
        counts={myTasks![1]}
        teamOverdue={myTasks![0].teamOverdue}
        today={today}
      />
    ),

    stats: () => (
      <div className="grid grid-cols-2 gap-4 @2xl:grid-cols-4">
        <StatCard
          label="Dossiers actifs"
          value={countCases(stats, { status: "active" })}
          href={casesLink()}
        />
        <StatCard
          label="Mes dossiers"
          value={countCases(stats, { status: "active", assignedTo: u.member.userId })}
          hint="actifs, dont je suis responsable"
          href={casesLink("mes-dossiers")}
        />
        <StatCard
          label="Ajoutés cette semaine"
          value={countCreatedLastWeek(stats)}
          className="max-md:hidden"
        />
        <StatCard
          label="Candidats admis"
          value={results!.admitted}
          hint="au moins une formation acceptée"
          className="max-md:hidden"
        />
      </div>
    ),

    pipeline: () => {
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
      return <StagePipeline campaignId={single!.id} stages={pipeline} />;
    },

    // Plusieurs campagnes : une carte chacune, avec sa prochaine échéance
    campaigns: () => (
      // Pas de colonne vide : deux campagnes, deux colonnes
      <ul
        className={cn(
          "grid gap-4 @xl:grid-cols-2",
          campaigns.length > 2 && "@4xl:grid-cols-3",
        )}
      >
        {campaigns.map((c) => {
          const activeCount = countCases(stats, { campaignId: c.id, status: "active" });
          const next = nextDeadline(
            dates.filter((d) => d.campaignId === c.id),
            today,
          );
          return (
            <li key={c.id}>
              <Link
                href={`/dashboard?campaign=${c.id}`}
                className="group flex h-full flex-col rounded-2xl border bg-card px-5 py-4 transition-colors hover:border-primary/40 hover:bg-highlight/40"
              >
                <span className="font-semibold group-hover:text-link">{c.name}</span>
                <span className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                  {plural(activeCount, "dossier actif", "dossiers actifs")}
                </span>
                <span className="mt-3 flex items-center gap-2 border-t pt-3 text-sm">
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {next ? (
                    <>
                      <span className="min-w-0 truncate">{next.label}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                        {countdownLabel(next.days)}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">Aucune échéance à venir</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    ),

    payments: () => {
      const monthRows = (monthRes.data ?? []) as { amount: number | string; payments: number }[];
      const collected = monthRows.reduce((n, r) => n + Number(r.amount), 0);
      const collectedCount = monthRows.reduce((n, r) => n + r.payments, 0);
      const owing = sumStat(stats, "owing");
      const feeUnset = sumStat(stats, "fee_unset");
      const topOwing = (owingRes.data ?? []) as {
        id: string;
        first_name: string;
        last_name: string;
        remaining_amount: number;
      }[];
      return (
        <Panel
          title="Paiements"
          description={campaigns.length > 1 ? "Toutes les campagnes actives." : undefined}
          actions={
            <PanelLink href={paymentsLink()} icon={Wallet}>
              Tous les paiements
            </PanelLink>
          }
        >
          <div className="grid gap-5 px-5 py-4 @3xl:grid-cols-[1fr_1fr]">
            <div className="grid grid-cols-2 gap-4 @md:grid-cols-3 @3xl:grid-cols-2 @5xl:grid-cols-3">
              <PaymentFigure
                label={`Encaissé en ${monthName.format(new Date())}`}
                value={formatDA(collected)}
                hint={plural(collectedCount, "paiement")}
                href={paymentsLink()}
              />
              <PaymentFigure
                label="Reste à encaisser"
                value={formatDA(sumStat(stats, "remaining"))}
                hint={plural(owing, "dossier")}
                href={owing > 0 ? paymentsLink({ vue: "restes" }) : undefined}
              />
              <PaymentFigure
                label="Montant à fixer"
                value={String(feeUnset)}
                hint={`${pluralWord(feeUnset, "dossier actif", "dossiers actifs")} sans montant convenu`}
                href={feeUnset > 0 ? casesLink("montant-a-fixer") : undefined}
                className="col-span-2 @md:col-span-1 @3xl:col-span-2 @5xl:col-span-1"
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
      );
    },

    deadlines: () => (
      <DeadlinesPanel
        campaignId={single!.id}
        items={timeline(
          dates.filter((d) => d.campaignId === single!.id),
          today,
        )}
      />
    ),

    results: () => <ResultsPanel results={results!} />,

    stale: () => (
      <StalePanel stale={stale!} memberNames={memberNames} currentUserId={u.member.userId} />
    ),

    cashflow: () => (
      <CashflowPanel
        months={cashflow!}
        href={paymentsLink()}
        monthHref={(from, to) => paymentsLink({ periode: "dates", du: from, au: to })}
      />
    ),

    teamTasks: () => <TeamOverduePanel rows={teamOverdue!} memberNames={memberNames} today={today} />,

    activity: () => <ActivityPanel entries={activity} />,
  };

  const widgets: WidgetEntry[] = allowed.map((id) => ({
    id,
    node: shown.has(id) ? render[id]() : null,
    note: applicableWidget(id, campaigns.length)
      ? undefined
      : (WIDGETS[id] as WidgetDef).scope === "single"
        ? "S'affiche quand une seule campagne est choisie."
        : "S'affiche quand plusieurs campagnes sont actives.",
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
            <CustomizeButton />
            {/* Téléphone aussi : l'action la plus fréquente, sous le bonjour */}
            {!readOnly && <NewCaseLink campaignId={selected?.id} />}
          </>
        }
      />
      {guide.welcome}
      {guide.checklist}
      <InstallAppCard appName={BRAND.name} />

      <DashboardWidgets
        layout={layouts.layout}
        widgets={widgets}
        personal={layouts.personal}
        fallback={layouts.fallback}
        isOwner={u.member.isOwner}
      />
    </PageContainer>
  );
}

// Mot de bienvenue (première connexion) et guide du patron. Le guide
// disparaît en lecture seule : ses étapes ne pourraient plus se faire.
async function loadGuide(member: Member, readOnlyPromise: Promise<boolean>) {
  const [welcome, readOnly, sub, progress] = await Promise.all([
    needsWelcome(member),
    readOnlyPromise,
    getSubscription(member.agencyId),
    loadOnboarding(member),
  ]);
  return {
    welcome: welcome ? (
      <WelcomeDialog
        firstName={member.firstName}
        isOwner={member.isOwner}
        trialDays={sub.state === "trial" ? daysLeft(sub.endsAt) : null}
      />
    ) : null,
    checklist: progress && !readOnly ? <OnboardingChecklist progress={progress} /> : null,
  };
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
