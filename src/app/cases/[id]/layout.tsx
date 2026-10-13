import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireMember } from "@/lib/auth/require-member";
import {
  LEVEL_LABELS,
  STATUS_LABELS,
  labelOf,
  procedureLabel,
} from "@/features/cases/labels";
import { displayName } from "@/lib/names";
import { cn } from "@/lib/utils";
import { getCase } from "@/features/cases/server/get-case";
import { PastelPinned } from "@/features/cases/components/pastel-pinned";
import { CaseStatusButtons } from "@/features/cases/components/case-status-buttons";
import { CaseTabs } from "@/features/cases/components/case-tabs";

const BADGE: Record<string, string> = {
  active: "bg-success-bg text-success",
  closed: "bg-muted text-muted-foreground",
  abandoned: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export default async function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const caller = await requireMember();
  if (!caller) redirect("/login");

  const { id } = await params;
  const data = await getCase(id);
  if (!data) notFound();
  const { c, responsible, campaignLabel } = data;

  const summary = [
    labelOf(LEVEL_LABELS, c.education_level),
    procedureLabel(c.main_track, c.schools),
    responsible ? `Responsable : ${responsible}` : "Sans responsable",
    campaignLabel ? `Campagne ${campaignLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-tight">
                  {displayName(c.first_name, c.last_name)}
                </h1>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                    BADGE[c.status],
                  )}
                >
                  {labelOf(STATUS_LABELS, c.status)}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/cases/${c.id}/edit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Modifier
              </Link>
              <CaseStatusButtons id={c.id} status={c.status} />
            </div>
          </div>

          <PastelPinned
            key={c.id}
            caseId={c.id}
            account={c.pastel_account}
            email={c.pastel_email}
          />

          <CaseTabs id={c.id} isOwner={caller.profile.role === "owner"} />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">{children}</div>
    </div>
  );
}
