import type { Metadata } from "next";
import { LogoMark } from "@/components/auth/auth-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { displayName } from "@/lib/names";
import { getStudentCase } from "@/features/student/server/student-case";
import { StudentLogout, StudentTabs } from "@/features/student/components/student-nav";

export const metadata: Metadata = { title: "Mon dossier · StudyFlow" };

// Espace du candidat : lecture seule de ses informations, de sa lettre de
// motivation et de ses formations.
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { c, agency } = await getStudentCase();

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-4xl px-4 md:px-8">
          <div className="flex h-14 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <LogoMark className="size-8" />
              <span className="truncate text-sm font-medium text-muted-foreground">
                Espace candidat · {agency.name}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle className="size-9 rounded-xl text-muted-foreground" />
              <StudentLogout />
            </div>
          </div>
          <div className="pt-3">
            <h1 className="text-[22px] font-semibold tracking-tight">
              {displayName(c.first_name, c.last_name)}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Dossier suivi par {agency.name} · {agency.phone}
            </p>
          </div>
          <div className="mt-3">
            <StudentTabs />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
