import type { ReactNode } from "react";
import {
  CalendarClock,
  Check,
  FileText,
  Folder,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
    >
      <GraduationCap className="size-5" strokeWidth={1.8} />
    </span>
  );
}

// Carte « verre » du panneau de présentation
function Glass({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/40 ring-1 ring-inset ring-white/5 backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Aperçu décoratif de l'application : une échéance, une fiche candidat et
// une ligne d'activité. Données fictives, ignorées par les lecteurs d'écran.
function AppPreview() {
  return (
    <div aria-hidden className="relative mx-auto h-[21rem] w-full max-w-md select-none">
      {/* Fiche candidat */}
      <Glass className="absolute top-16 right-12 left-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[oklch(0.62_0.19_260)]/25 text-sm font-semibold text-[oklch(0.85_0.08_260)]">
            SB
          </span>
          <div className="min-w-0 flex-1 pr-24">
            <p className="flex items-center gap-2 font-semibold text-white">
              <span className="truncate">BENALI Sara</span>
              <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                Actif
              </span>
            </p>
            <p className="truncate text-xs text-white/55">Campus France 2026/2027 · L3</p>
          </div>
        </div>
        <div className="mt-4 space-y-1.5 text-[13px]">
          {[
            { name: "Candidature", count: 3 },
            { name: "Visa", count: 1 },
            { name: "Informations personnelles", count: 2 },
          ].map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-white/80"
            >
              <Folder className="size-3.5 text-white/45" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs tabular-nums text-white/45">{f.count}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-white/80">
            <FileText className="size-3.5 text-white/45" />
            <span className="flex-1">Lettre de motivation</span>
            <Check className="size-3.5 text-emerald-300" />
          </div>
        </div>
      </Glass>

      {/* Prochaine échéance */}
      <Glass className="absolute top-0 right-0 w-44 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:delay-150 motion-safe:fill-mode-backwards">
        <p className="flex items-center gap-1.5 text-xs font-medium text-white/60">
          <CalendarClock className="size-3.5" /> Prochaine échéance
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-[oklch(0.8_0.12_255)] tabular-nums">
          J-47
        </p>
        <p className="mt-0.5 text-xs text-white/55">Date limite DAP · 15 déc.</p>
      </Glass>

      {/* Activité */}
      <Glass className="absolute right-0 bottom-0 left-10 flex items-center gap-3 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:delay-300 motion-safe:fill-mode-backwards">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white/80">
          YK
        </span>
        <p className="min-w-0 flex-1 truncate text-[13px] text-white/70">
          <span className="font-medium text-white">Yasmine</span> a ajouté un document
        </p>
        <span className="shrink-0 text-[11px] text-white/40">il y a 2 min</span>
      </Glass>
    </div>
  );
}

// Page d'authentification : panneau de présentation à gauche (écrans larges),
// formulaire à droite. Sur mobile, seul le formulaire est affiché.
export function AuthShell({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-[oklch(0.18_0.035_265)] p-12 text-white lg:flex lg:flex-col">
        {/* Halo et quadrillage discret, estompés vers les bords */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full bg-[oklch(0.55_0.22_262)] opacity-25 blur-[120px]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
            <GraduationCap className="size-5" strokeWidth={1.8} />
          </span>
          <span className="text-xl font-semibold tracking-tight">StudyFlow</span>
        </div>

        <div className="relative my-auto py-8">
          <h2 className="max-w-md text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
            Le CRM des agences d&apos;études à l&apos;étranger.
          </h2>
          <p className="mt-4 max-w-md text-base text-white/60">
            Candidats, pièces, lettres et échéances au même endroit, pour toute
            l&apos;équipe.
          </p>
          <div className="mt-10 [@media(max-height:680px)]:hidden">
            <AppPreview />
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs whitespace-nowrap text-white/45">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" /> Données isolées par agence
            </span>
            <span className="flex items-center gap-1.5">
              <LockKeyhole className="size-3.5" /> Mots de passe chiffrés
            </span>
          </span>
          <span>© {new Date().getFullYear()} StudyFlow</span>
        </div>
      </aside>

      <main
        className={cn(
          "relative flex min-h-dvh flex-col bg-background px-5 sm:px-10",
          compact ? "py-2" : "py-6",
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <LogoMark />
            <span className="text-lg font-semibold tracking-tight">StudyFlow</span>
          </div>
          <ThemeToggle className="size-9 rounded-xl text-muted-foreground" />
        </div>

        <div
          className={cn(
            "mx-auto flex w-full max-w-100 flex-1 flex-col justify-center",
            compact ? "py-2" : "py-10",
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
