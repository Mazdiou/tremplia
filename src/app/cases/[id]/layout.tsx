import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { StatusPill } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { requireMember } from "@/lib/auth/require-member";
import {
  EDUCATION_LEVEL_LABELS,
  STATUS_LABELS,
  labelOf,
} from "@/features/cases/labels";
import { displayName, initialsOf } from "@/lib/names";
import { mergePlatforms } from "@/features/cases/platforms";
import { listUsedPlatforms } from "@/features/cases/server/lookups";
import { getCase } from "@/features/cases/server/get-case";
import { ExternalAccountsPinned } from "@/features/cases/components/external-accounts-pinned";
import { CaseStatusButtons } from "@/features/cases/components/case-status-buttons";
import { CaseTabs } from "@/features/cases/components/case-tabs";
import { getStudentAccess } from "@/features/student/server/access";
import { StudentAccessBar } from "@/features/student/components/student-access-bar";
import {
  CaseHeaderDetails,
  CaseHeaderToggle,
} from "@/features/cases/components/case-header";

const STATUS_TONE = { active: "ok", closed: "off", abandoned: "bad" } as const;


export default async function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const member = await requireMember();
  if (!member) redirect("/login");

  const { id } = await params;
  const data = await getCase(id);
  if (!data) notFound();
  const { c, responsible, campaign, groups, externalAccounts } = data;
  // Plateformes proposées pour un nouveau compte : celles suggérées par la
  // campagne, puis celles déjà utilisées dans l'agence
  const [usedPlatforms, studentAccess] = await Promise.all([
    listUsedPlatforms(),
    getStudentAccess(member.agencyId, c.id),
  ]);
  const suggestions = mergePlatforms(campaign?.suggested_platforms ?? [], usedPlatforms);

  const summary = [
    campaign?.name,
    labelOf(EDUCATION_LEVEL_LABELS, c.education_level),
    responsible ? `Responsable : ${responsible}` : "Sans responsable",
  ]
    .filter(Boolean)
    .join(" · ");

  const title = (
    <div className="flex min-w-0 items-center gap-2">
      <h1 className="truncate text-[22px] font-semibold tracking-tight">
        {displayName(c.first_name, c.last_name)}
      </h1>
      <StatusPill tone={STATUS_TONE[c.status] ?? "off"}>
        {labelOf(STATUS_LABELS, c.status)}
      </StatusPill>
    </div>
  );

  return (
    <div>
      {/* En-tête fixe, partagé par tous les onglets */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 pt-5 md:px-8">
          <Link
            href="/cases"
            className="mb-3 inline-flex h-8 items-center rounded-lg border px-3 text-sm md:hidden"
          >
            ← Dossiers
          </Link>
          <CaseHeaderDetails
            compact={
              <div className="flex items-center justify-between gap-3">
                {title}
                <CaseHeaderToggle />
              </div>
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground max-sm:hidden"
                >
                  {initialsOf(c.first_name, c.last_name)}
                </span>
                <div className="min-w-0">
                  {title}
                  <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
                  {groups.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Groupes">
                      {groups.map((g) => (
                        <li
                          key={g.id}
                          className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground"
                        >
                          {g.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/cases/${c.id}/edit`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Pencil /> Modifier
                </Link>
                <CaseStatusButtons id={c.id} status={c.status} />
                <CaseHeaderToggle />
              </div>
            </div>

            <ExternalAccountsPinned
              key={c.id}
              caseId={c.id}
              accounts={externalAccounts}
              suggestions={suggestions}
            />
            <StudentAccessBar
              key={`student-${c.id}`}
              caseId={c.id}
              access={studentAccess}
              blockedReason={
                c.status === "abandoned"
                  ? "le dossier est abandonné"
                  : campaign?.status === "archived"
                    ? "la campagne est archivée"
                    : null
              }
            />
          </CaseHeaderDetails>

          <CaseTabs id={c.id} isOwner={member.isOwner} />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">{children}</div>
    </div>
  );
}
