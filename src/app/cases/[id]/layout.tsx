import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Pencil, Phone, UserRound } from "lucide-react";
import { getAgency } from "@/features/agency/server/get-agency";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { WhatsAppMenu } from "@/features/whatsapp/components/whatsapp-menu";
import { StatusPill } from "@/components/page-ui";
import { buttonVariants } from "@/components/ui/button";
import { requireMember } from "@/lib/auth/require-member";
import {
  EDUCATION_LEVEL_LABELS,
  STATUS_LABELS,
  labelOf,
} from "@/features/cases/labels";
import { displayName } from "@/lib/names";
import { mergePlatforms } from "@/features/cases/platforms";
import { listUsedPlatforms } from "@/features/cases/server/lookups";
import { getCase } from "@/features/cases/server/get-case";
import { ExternalAccountsPinned } from "@/features/cases/components/external-accounts-pinned";
import { CaseStatusButtons } from "@/features/cases/components/case-status-buttons";
import { CaseTabs } from "@/features/cases/components/case-tabs";
import { CaseStageControl } from "@/features/stages/components/case-stage-control";
import { getStudentAccess } from "@/features/student/server/access";
import { readReview } from "@/features/student/server/review";
import { agencyUnreadCounts } from "@/features/messages/server/messages";
import { dateTimeFormat, todayInAppTimezone } from "@/lib/dates";
import { formatDA } from "@/lib/money";
import { StudentAccessBar } from "@/features/student/components/student-access-bar";
import {
  CaseHeaderDetails,
  CaseHeaderToggle,
  TrackPanel,
} from "@/features/cases/components/case-header";
import { telHref } from "@/lib/phone";
import { isUuid } from "@/lib/validation";
import { countOpenCaseTasks, listTaskMembers } from "@/features/tasks/server/read";

const STATUS_TONE = { active: "ok", closed: "off", abandoned: "bad" } as const;

// Titre de l'onglet : le nom du candidat, pour retrouver un dossier parmi
// plusieurs onglets ouverts (getCase est déjà en cache pour la requête)
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const data = await getCase((await params).id);
  return { title: data ? displayName(data.c.first_name, data.c.last_name) : "Dossier introuvable" };
}

export default async function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const [member, { id }] = await Promise.all([requireMember(), params]);
  if (!member) redirect("/login");

  // Tout est lu en même temps. Les lectures avec la clé secrète sont filtrées
  // sur l'agence de la session : un dossier d'une autre agence n'y renvoie
  // rien, et getCase (via le RLS) le déclare introuvable.
  const [data, usedPlatforms, studentAccess, review, unread, agency, readOnly, openTasks, members] = await Promise.all([
    getCase(id),
    listUsedPlatforms(),
    isUuid(id) ? getStudentAccess(member.agencyId, id) : null,
    isUuid(id) ? readReview(member.agencyId, id) : null,
    agencyUnreadCounts(member.agencyId),
    getAgency(member.agencyId),
    isReadOnly(member.agencyId),
    isUuid(id) ? countOpenCaseTasks(id) : 0,
    listTaskMembers(),
  ]);
  if (!data) notFound();
  const { c, responsible, campaign, groups, stages, externalAccounts } = data;
  // Plateformes proposées pour un nouveau compte : celles suggérées par la
  // campagne, puis celles déjà utilisées dans l'agence
  const suggestions = mergePlatforms(campaign?.suggested_platforms ?? [], usedPlatforms);

  // Messages WhatsApp proposés : le code seulement si le candidat peut
  // vraiment se connecter, le rappel seulement pour un dossier non abandonné
  const blockedReason =
    c.status === "abandoned"
      ? "le dossier est abandonné"
      : campaign?.status === "archived"
        ? "la campagne est archivée"
        : null;
  const whatsapp = {
    candidate: c.first_name,
    agencyName: agency?.name ?? "",
    agencyPhone: agency?.phone ?? "",
    accessCode: studentAccess?.enabled && !blockedReason ? studentAccess.code : null,
    remaining: c.status === "abandoned" ? null : c.remaining_amount,
  };

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
      {c.remaining_amount !== null && (
        <Link
          href={`/cases/${c.id}/payments`}
          className="flex shrink-0 rounded-full focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none max-md:hidden @max-xl:hidden"
        >
          <StatusPill tone={c.remaining_amount > 0 ? "warn" : "ok"}>
            {c.remaining_amount > 0 ? `Reste ${formatDA(c.remaining_amount)}` : "Soldé"}
          </StatusPill>
        </Link>
      )}
    </div>
  );

  return (
    <div>
      {/* En-tête partagé par tous les onglets. Fixe sur ordinateur ; sur
          téléphone il défile avec la page : déplié, il prendrait presque
          tout l'écran et le contenu glisserait dessous */}
      {/* Mise en page selon la place laissée par l'arbre des dossiers
          (conteneur), et non selon l'écran. Sur téléphone, pas de conteneur :
          le menu WhatsApp s'y affiche en bas de l'écran (position fixe). */}
      <header className="z-10 border-b bg-band/95 backdrop-blur md:sticky md:top-0">
        <div className="mx-auto max-w-5xl px-4 pt-5 md:px-8 md:@container">
          <Link
            href="/cases"
            className="mb-3 inline-flex h-8 items-center rounded-lg border px-3 text-sm md:hidden"
          >
            ← Dossiers
          </Link>
          <CaseHeaderDetails
            compact={
              // Réduit : moins d'espace sous la ligne et, sur ordinateur (pas
              // de lien « Dossiers » au-dessus), moins d'espace au-dessus
              <div className="-mb-2 flex items-center justify-between gap-3 md:-mt-2">
                {title}
                <CaseHeaderToggle collapsed />
              </div>
            }
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {title}
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span>{summary}</span>
                  {groups.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label="Groupes">
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
                <ul className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" aria-label="Contacts">
                  <li className="flex items-center gap-1">
                    <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                    <a href={telHref(c.phone)} className="touch-target hover:underline">
                      {c.phone}
                    </a>
                    <WhatsAppMenu
                      phone={c.phone}
                      recipient={displayName(c.first_name, c.last_name)}
                      context={whatsapp}
                    />
                  </li>
                  {c.secondary_contact_name && c.secondary_contact_phone && (
                    <li className="flex items-center gap-1">
                      <UserRound className="size-3.5 text-muted-foreground" aria-hidden />
                      <span className="text-muted-foreground">{c.secondary_contact_name} ·</span>
                      <a href={telHref(c.secondary_contact_phone)} className="hover:underline">
                        {c.secondary_contact_phone}
                      </a>
                      <WhatsAppMenu
                        phone={c.secondary_contact_phone}
                        recipient={c.secondary_contact_name}
                        context={{ ...whatsapp, parent: c.secondary_contact_name }}
                      />
                    </li>
                  )}
                </ul>
              </div>
              <div className="flex items-center gap-2 max-md:w-full @max-xl:w-full">
                {/* Abonnement expiré : rien à modifier */}
                {!readOnly && (
                  <>
                    <Link
                      href={`/cases/${c.id}/edit`}
                      className={buttonVariants({ variant: "outline" })}
                    >
                      <Pencil /> Modifier
                    </Link>
                    <CaseStatusButtons
                      id={c.id}
                      status={c.status}
                      openTasks={openTasks}
                      taskContext={{
                        caseId: c.id,
                        members,
                        currentUserId: member.userId,
                        today: todayInAppTimezone(),
                      }}
                    />
                  </>
                )}
                <span className="max-md:ml-auto @max-xl:ml-auto">
                  <CaseHeaderToggle collapsed={false} />
                </span>
              </div>
            </div>

            <TrackPanel>
              <CaseStageControl
                key={`stage-${c.id}`}
                caseId={c.id}
                stages={stages}
                stageId={c.stage_id}
                readOnly={readOnly}
              />
              <ExternalAccountsPinned
                key={c.id}
                caseId={c.id}
                accounts={externalAccounts}
                suggestions={suggestions}
                readOnly={readOnly}
              />
              <StudentAccessBar
                key={`student-${c.id}`}
                caseId={c.id}
                access={studentAccess}
                review={{
                  status: review?.status ?? "pending",
                  respondedLabel: review?.respondedAt
                    ? dateTimeFormat.format(new Date(review.respondedAt))
                    : null,
                  lastRequest:
                    review?.status === "changes_requested" ? (review.lastRequest?.body ?? null) : null,
                }}
                blockedReason={blockedReason}
                whatsapp={{ phone: c.phone, context: whatsapp }}
                readOnly={readOnly}
              />
            </TrackPanel>
          </CaseHeaderDetails>

          <CaseTabs
            id={c.id}
            isOwner={member.isOwner}
            unreadMessages={unread[c.id] ?? 0}
            openTasks={openTasks}
          />
        </div>
      </header>

      <div className="@container mx-auto max-w-5xl px-4 py-6 md:px-8">{children}</div>
    </div>
  );
}
