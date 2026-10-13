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

export default async function DashboardPage() {
  const u = await getShellUser();
  const supabase = await createClient();
  const today = todayInAppTimezone();

  // Toutes les campagnes actives (le choix d'une campagne arrive au Lot 5)
  const campaigns = (await listCampaigns()).filter((c) => c.status === "active");
  const ids = campaigns.map((c) => c.id);
  const hasCampaigns = ids.length > 0;

  const count = (build: (q: ReturnType<typeof base>) => unknown) =>
    hasCampaigns ? (build(base()) as PromiseLike<{ count: number | null }>) : null;
  const base = () =>
    supabase
      .from("cases")
      .select("id", { count: "exact", head: true })
      .in("campaign_id", ids);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const weekAgo = weekStart.toISOString();
  const [active, mine, week, ended, ...levels] = hasCampaigns
    ? await Promise.all([
        count((q) => q.eq("status", "active")),
        count((q) => q.eq("status", "active").eq("assigned_to", u.member.userId)),
        count((q) => q.gte("created_at", weekAgo)),
        count((q) => q.in("status", ["closed", "abandoned"])),
        ...EDUCATION_LEVELS.map((l) =>
          count((q) => q.eq("status", "active").eq("education_level", l)),
        ),
      ])
    : [];
  const n = (r: { count: number | null } | null | undefined) => r?.count ?? 0;

  const { data: recent } = hasCampaigns
    ? await supabase
        .from("cases")
        .select("id, first_name, last_name, education_level, created_at")
        .in("campaign_id", ids)
        .order("created_at", { ascending: false })
        .limit(5)
    : { data: [] };

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

  const next = nextDeadline(await listCampaignDates(campaigns), today);
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
          subtitle={
            hasCampaigns
              ? `${campaigns.length > 1 ? `${campaigns.length} campagnes actives` : campaigns[0].name}${u.member.isOwner ? " · vue du patron" : ""}`
              : "Aucune campagne active"
          }
          actions={<NewCaseLink className="max-md:hidden" />}
        />

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
