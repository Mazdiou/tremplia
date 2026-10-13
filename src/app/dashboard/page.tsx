import { createClient } from "@/lib/supabase/server";
import { AppShell, getShellUser } from "@/components/shell/app-shell";
import { NewCaseLink, PageHeader, Panel, StatCard } from "@/components/page-ui";
import { countdownLabel, nextDeadline } from "@/features/campaigns/timeline";
import { listCampaignDates, listCampaigns } from "@/features/campaigns/server/queries";
import { activityLabel } from "@/features/history/labels";
import { APP_TIMEZONE, formatLongDate, todayInAppTimezone } from "@/lib/dates";
import {
  EDUCATION_LEVELS,
  EDUCATION_LEVEL_LABELS,
  labelOf,
} from "@/features/cases/labels";
import { displayName } from "@/lib/names";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { CampaignSelect } from "@/features/dashboard/components/campaign-select";

const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: APP_TIMEZONE });
const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
});

function dayKey(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
  }).format(d);
}

// « aujourd'hui », « hier », « il y a 2 jours », puis la date
function relativeDay(iso: string) {
  const d = new Date(iso);
  const diff = Math.round(
    (Date.parse(dayKey(new Date())) - Date.parse(dayKey(d))) / 86_400_000,
  );
  if (diff <= 0) return "aujourd'hui";
  if (diff === 1) return "hier";
  if (diff < 7) return `il y a ${diff} jours`;
  return dayFmt.format(d);
}

// Heure pour aujourd'hui, sinon jour relatif
function activityWhen(iso: string) {
  const diff = relativeDay(iso);
  return diff === "aujourd'hui" ? timeFmt.format(new Date(iso)) : diff;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const u = await getShellUser();
  const supabase = await createClient();
  const today = todayInAppTimezone();

  // Toutes les campagnes actives, ou celle choisie dans le sélecteur
  const allActive = (await listCampaigns()).filter((c) => c.status === "active");
  const wanted = (await searchParams).campaign;
  const selected = allActive.find((c) => c.id === wanted) ?? null;
  const campaigns = selected ? [selected] : allActive;
  const ids = campaigns.map((c) => c.id);

  if (ids.length === 0) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-8">
          <PageHeader title={`Bonjour ${u.member.firstName}`} />
          <EmptyState
            icon={CalendarRange}
            title="Bienvenue dans StudyFlow"
            description={
              u.member.isOwner
                ? "Commencez par créer une campagne ou importer un modèle (Campus France, par exemple) : vous pourrez ensuite y ajouter vos dossiers."
                : "Aucune campagne active pour le moment. Prévenez le patron : il doit créer une campagne avant que vous puissiez ajouter des dossiers."
            }
          />
          {u.member.isOwner && (
            <div className="flex justify-center gap-2">
              <Link href="/campaigns#modeles" className={buttonVariants({ variant: "outline" })}>
                Importer un modèle
              </Link>
              <Link href="/campaigns/new" className={buttonVariants()}>
                Créer une campagne
              </Link>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  const count = (build: (q: ReturnType<typeof base>) => unknown) =>
    build(base()) as PromiseLike<{ count: number | null }>;
  const base = () =>
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .in("campaign_id", ids);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekAgo = weekStart.toISOString();
  const [active, mine, week, ended, ...levels] = await Promise.all([
    count((q) => q.eq("status", "active")),
    count((q) => q.eq("status", "active").eq("assigned_to", u.member.userId)),
    count((q) => q.gte("created_at", weekAgo)),
    count((q) => q.in("status", ["closed", "abandoned"])),
    ...EDUCATION_LEVELS.map((l) =>
      count((q) => q.eq("status", "active").eq("education_level", l)),
    ),
  ]);
  const n = (r: { count: number | null } | undefined) => r?.count ?? 0;

  const { data: recent } = await supabase
    .from("cases")
    .select("id, first_name, last_name, education_level, created_at")
    .in("campaign_id", ids)
    .order("created_at", { ascending: false })
    .limit(5);

  // Journal : lisible par le patron seulement (règle RLS)
  const { data: activity } = u.member.isOwner
    ? await supabase
        .from("activity_log")
        .select("id, actor_id, action, created_at")
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: null };
  const actorIds = [
    ...new Set(
      (activity ?? []).flatMap((a) =>
        a.actor_id ? [a.actor_id as string] : [],
      ),
    ),
  ];
  const { data: actors } = actorIds.length
    ? await supabase
        .from("profiles")
        .select("id, first_name")
        .in("id", actorIds)
    : { data: [] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.first_name]));

  const dates = await listCampaignDates(campaigns);
  const next = nextDeadline(dates, today);

  // Vue « toutes les campagnes » : une carte par campagne
  const cards =
    !selected && campaigns.length > 1
      ? await Promise.all(
          campaigns.map(async (c) => {
            const { count: activeCount } = await supabase
              .from("cases")
              .select("id", { count: "exact", head: true })
              .eq("campaign_id", c.id)
              .eq("status", "active");
            return {
              ...c,
              activeCount: activeCount ?? 0,
              next: nextDeadline(
                dates.filter((d) => d.campaignId === c.id),
                today,
              ),
            };
          }),
        )
      : [];
  // Les niveaux sans dossier ne s'affichent que s'ils sont courants
  const levelRows = EDUCATION_LEVELS.map((l, i) => ({ l, n: n(levels[i]) })).filter(
    (r) => r.n > 0 || ["terminale", "l1", "l2", "l3", "m1"].includes(r.l),
  );
  const maxLevel = Math.max(1, ...levelRows.map((r) => r.n));

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl p-4 md:p-8">
        <PageHeader
          title={`Bonjour ${u.member.firstName}`}
          subtitle={`${selected ? selected.name : campaigns.length > 1 ? `${campaigns.length} campagnes actives` : campaigns[0].name}${u.member.isOwner ? " · vue du patron" : ""}`}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {allActive.length > 1 && (
                <CampaignSelect campaigns={allActive} value={selected?.id ?? ""} />
              )}
              <NewCaseLink className="max-md:hidden" />
            </div>
          }
        />

        {cards.length > 0 && (
          <ul className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard?campaign=${c.id}`}
                  className="block rounded-2xl border bg-card px-5 py-4 hover:bg-muted/40"
                >
                  <p className="font-semibold">{c.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {c.activeCount} dossier{c.activeCount > 1 ? "s" : ""} actif
                    {c.activeCount > 1 ? "s" : ""}
                  </p>
                  <p className="mt-1 text-sm">
                    {c.next
                      ? `${c.next.label} · ${countdownLabel(c.next.days)}`
                      : "Aucune échéance à venir"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Dossiers actifs" value={n(active)} />
          <StatCard label="Mes dossiers" value={n(mine)} />
          <StatCard
            label="Ajoutés cette semaine"
            value={n(week)}
            className="max-md:hidden"
          />
          <StatCard
            label="Clos ou abandonnés"
            value={n(ended)}
            className="max-md:hidden"
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="Prochaine échéance" highlight>
            <div className="px-[18px] py-5">
              {next ? (
                <>
                  <p className="text-lg font-semibold">{next.label}</p>
                  <p className="mt-0.5 text-muted-foreground">
                    {formatLongDate(next.date)}
                    {campaigns.length > 1 ? ` · ${next.campaignName}` : ""}
                  </p>
                  <p className="mt-1.5 text-sm text-accent-foreground">
                    {countdownLabel(next.days)}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune échéance à venir.
                </p>
              )}
            </div>
          </Panel>

          <Panel title="Dossiers actifs par niveau" className="max-md:hidden">
            <div className="space-y-3 px-[18px] py-4">
              {levelRows.map(({ l, n: v }) => (
                <div
                  key={l}
                  className="grid grid-cols-[5rem_1fr_1.5rem] items-center gap-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {EDUCATION_LEVEL_LABELS[l]}
                  </span>
                  <span
                    className="h-1.5 rounded-full bg-primary"
                    style={{ width: `${Math.max(4, (v / maxLevel) * 100)}%` }}
                  />
                  <span className="text-right tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Ajoutés récemment">
            {(recent ?? []).length === 0 ? (
              <p className="px-[18px] py-5 text-sm text-muted-foreground">
                Aucun dossier pour le moment.
              </p>
            ) : (
              <ul>
                {(recent ?? []).slice(0, 3).map((c) => (
                  <li key={c.id} className="border-b last:border-b-0">
                    <Link
                      href={`/cases/${c.id}`}
                      className="flex items-baseline justify-between gap-3 px-[18px] py-3 text-sm hover:bg-muted/50"
                    >
                      <span className="min-w-0 truncate">
                        {displayName(c.first_name, c.last_name)}
                        <span className="text-muted-foreground">
                          {" · "}
                          {labelOf(EDUCATION_LEVEL_LABELS, c.education_level)}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
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
            className="mt-5 max-md:hidden"
          >
            {(activity ?? []).length === 0 ? (
              <p className="px-[18px] py-5 text-sm text-muted-foreground">
                Aucune activité enregistrée.
              </p>
            ) : (
              <ul>
                {(activity ?? []).map((a) => (
                  <li
                    key={a.id}
                    className="flex justify-between gap-3 border-b px-[18px] py-3 text-sm last:border-b-0"
                  >
                    <span>
                      {(a.actor_id ? actorName.get(a.actor_id) : null) ??
                        "Quelqu'un"}{" "}
                      {activityLabel(a.action, "agency")}
                    </span>
                    <span className="text-muted-foreground">
                      {activityWhen(a.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <NewCaseLink className="mt-5 w-full md:hidden" />
      </div>
    </AppShell>
  );
}
