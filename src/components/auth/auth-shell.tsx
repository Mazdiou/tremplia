import type { ReactNode } from "react";
import {
  FileText,
  FolderKanban,
  GraduationCap,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const POINTS = [
  {
    icon: FolderKanban,
    title: "Tous vos dossiers au même endroit",
    text: "Vos documents classés comme vous le voulez.",
  },
  {
    icon: FileText,
    title: "Documents et notes centralisés",
    text: "Fini les pièces perdues dans les messageries.",
  },
  {
    icon: Users,
    title: "Toute l'équipe synchronisée",
    text: "Responsables, historique et accès par rôle.",
  },
  {
    icon: ShieldCheck,
    title: "Données isolées et protégées",
    text: "Chaque agence ne voit que ses propres dossiers.",
  },
];

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={
        "grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm " +
        (className ?? "")
      }
    >
      <GraduationCap className="size-5" strokeWidth={1.8} />
    </span>
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
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-[oklch(0.5_0.24_263)] via-[oklch(0.44_0.23_268)] to-[oklch(0.3_0.16_275)] p-12 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "26px 26px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-white/15 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-[oklch(0.7_0.15_240)]/30 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <GraduationCap className="size-5" strokeWidth={1.8} />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            StudyFlow
          </span>
        </div>

        <div className="relative my-auto max-w-md">
          <h2 className="text-4xl leading-tight font-semibold tracking-tight text-balance">
            Le CRM des agences de démarches étudiantes.
          </h2>
          <p className="mt-4 text-base text-white/75">
            Suivez chaque candidat, chaque pièce et chaque échéance, sans
            tableur ni messages éparpillés.
          </p>

          <ul className="mt-10 space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-white/12 ring-1 ring-white/20">
                  <Icon className="size-4.5" strokeWidth={1.7} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-white/65">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} StudyFlow
        </p>
      </aside>

      <main
        className={`relative flex min-h-dvh flex-col bg-background px-5 sm:px-10 ${
          compact ? "py-2" : "py-6"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <LogoMark />
            <span className="text-lg font-semibold tracking-tight">
              StudyFlow
            </span>
          </div>
          <ThemeToggle className="size-9 rounded-xl text-muted-foreground" />
        </div>

        <div
          className={`mx-auto flex w-full max-w-100 flex-1 flex-col justify-center ${
            compact ? "py-2" : "py-10"
          }`}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
