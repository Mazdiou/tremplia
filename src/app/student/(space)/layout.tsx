import type { Metadata } from "next";
import { LegalLinks } from "@/components/legal-page";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { displayName } from "@/lib/names";
import { dateTimeFormat } from "@/lib/dates";
import { getStudentCase, requireStudent } from "@/features/student/server/student-case";
import {
  contentFingerprint,
  hasContentToReview,
  readReview,
} from "@/features/student/server/review";
import { ReviewBanner } from "@/features/student/components/review-banner";
import { studentUnreadCount } from "@/features/messages/server/messages";
import { StudentLogout, StudentTabs } from "@/features/student/components/student-nav";
import { STUDENT_READ_ONLY } from "@/features/subscription/subscription";
import { isReadOnly } from "@/features/subscription/server/subscription";
import { InstallAppCard } from "@/features/pwa/components/install-app-card";
import { LiveRefresh } from "@/components/live-refresh";
import { PushKeeper } from "@/features/notifications/components/push-keeper";
import { pushPublicKey } from "@/features/notifications/server/push";
import { StudentNotificationsButton } from "@/features/notifications/components/student-notifications-button";
import { telHref } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Mon dossier",
  // Installée sur le téléphone : l'appli du candidat, distincte de celle de l'agence
  manifest: "/student/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Mon dossier", statusBarStyle: "default" },
};

// Espace du candidat : lecture seule de ses informations, de sa lettre de
// motivation et de ses formations.
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStudent();
  const publicKey = pushPublicKey();
  const owner = `case:${session.caseId}`;
  const [{ c, agency }, review, hasContent, fingerprint, unread, readOnly] = await Promise.all([
    getStudentCase(),
    readReview(session.agencyId, session.caseId),
    hasContentToReview(session.agencyId, session.caseId),
    contentFingerprint(session.agencyId, session.caseId),
    studentUnreadCount(session),
    isReadOnly(session.agencyId),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <LiveRefresh />
      {publicKey && <PushKeeper publicKey={publicKey} deviceUrl="/api/student/push" owner={owner} />}
      <header className="z-10 border-b bg-background/95 backdrop-blur sm:sticky sm:top-0">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <LogoMark className="size-8" />
              <span className="truncate text-sm font-medium text-muted-foreground">
                Espace candidat · {agency.name}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {publicKey && !readOnly && (
                <StudentNotificationsButton
                  publicKey={publicKey}
                  owner={owner}
                  agencyName={agency.name}
                />
              )}
              <ThemeToggle className="size-9 rounded-xl text-muted-foreground" />
              <StudentLogout />
            </div>
          </div>
          <div className="pt-3">
            <h1 className="text-[1.375rem] font-semibold tracking-tight">
              {displayName(c.first_name, c.last_name)}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Dossier suivi par {agency.name} ·{" "}
              <a href={telHref(agency.phone)} className="whitespace-nowrap hover:underline">
                {agency.phone}
              </a>
            </p>
          </div>
          <div className="mt-3">
            <StudentTabs unreadMessages={unread} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6 md:px-8">
        {/* Agence en lecture seule (abonnement expiré) : consultation seulement */}
        {readOnly && (
          <p role="status" className="rounded-xl border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
            {STUDENT_READ_ONLY}
          </p>
        )}
        {/* Rien à valider tant que l'agence n'a écrit ni lettre ni formation */}
        {hasContent && !readOnly && (
          <ReviewBanner
            status={review?.status ?? "pending"}
            respondedLabel={
              review?.respondedAt ? dateTimeFormat.format(new Date(review.respondedAt)) : null
            }
            lastRequest={review?.lastRequest?.body ?? null}
            agencyName={agency.name}
            fingerprint={fingerprint}
          />
        )}
        {/* Après l'avis attendu, plus important */}
        <InstallAppCard appName="votre espace candidat" />
        <div>{children}</div>
      </main>
      <footer className="mx-auto w-full max-w-4xl px-4 pb-4 md:px-8">
        <LegalLinks />
      </footer>
    </div>
  );
}
