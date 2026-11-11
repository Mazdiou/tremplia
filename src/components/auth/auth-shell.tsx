import type { ReactNode } from "react";
import Link from "next/link";
import {
  CalendarClock,
  Check,
  FileText,
  Folder,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { DecorLayers } from "@/components/decor";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { BRAND } from "@/config/brand";
import { LogoMark } from "@/components/logo-mark";
import { LEGAL_LINKS } from "@/config/legal";

// Carte « verre » du panneau de présentation
function Glass({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-glass-border bg-glass p-4 shadow-xl shadow-black/[0.06] backdrop-blur-md dark:shadow-2xl dark:shadow-black/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Aperçu décoratif de l'application : une échéance, une fiche candidat et
// une ligne d'activité. Données fictives, ignorées par les lecteurs d'écran.
export function AppPreview() {
  return (
    <div aria-hidden className="relative mx-auto h-[21rem] w-full max-w-md select-none">
      {/* Fiche candidat */}
      <Glass className="absolute top-16 right-12 left-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-decor-accent/15 text-sm font-semibold text-decor-accent">
            AM
          </span>
          <div className="min-w-0 flex-1 pr-24">
            <p className="flex items-center gap-2 font-semibold text-decor-foreground">
              <span className="truncate">MADIOU Amine</span>
              <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[0.6875rem] font-medium text-success">
                Actif
              </span>
            </p>
            <p className="truncate text-xs text-decor-muted">Campus France 2026/2027, L3</p>
          </div>
        </div>
        {/* Étape du dossier */}
        <div className="mt-4 flex items-center gap-2.5 text-[0.8125rem]">
          <span className="flex w-16 shrink-0 gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={i < 3 ? "h-1 flex-1 rounded-full bg-decor-accent" : "h-1 flex-1 rounded-full bg-decor-foreground/15"}
              />
            ))}
          </span>
          <span className="truncate text-decor-muted">
            Étape 3/5 : <span className="font-medium text-decor-foreground/85">Entretien</span>
          </span>
        </div>
        <div className="mt-3 space-y-1.5 text-[0.8125rem]">
          {[
            { name: "Candidature", count: 3 },
            { name: "Visa", count: 1 },
          ].map((f) => (
            <div
              key={f.name}
              className="flex items-center gap-2 rounded-lg bg-glass-row px-2.5 py-1.5 text-decor-foreground/85"
            >
              <Folder className="size-3.5 text-decor-subtle" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs tabular-nums text-decor-subtle">{f.count}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 rounded-lg bg-glass-row px-2.5 py-1.5 text-decor-foreground/85">
            <FileText className="size-3.5 text-decor-subtle" />
            <span className="flex-1">Lettre de motivation</span>
            <Check className="size-3.5 text-success" />
          </div>
        </div>
      </Glass>

      {/* Prochaine échéance */}
      <Glass className="absolute top-0 right-0 w-44 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:delay-150 motion-safe:fill-mode-backwards">
        <p className="flex items-center gap-1.5 text-xs font-medium text-decor-muted">
          <CalendarClock className="size-3.5" /> Prochaine échéance
        </p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-decor-accent tabular-nums">
          J-47
        </p>
        <p className="mt-0.5 text-xs text-decor-muted">Date limite DAP : 15 déc.</p>
      </Glass>

      {/* Activité */}
      <Glass className="absolute right-0 bottom-0 left-10 flex items-center gap-3 py-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 motion-safe:delay-300 motion-safe:fill-mode-backwards">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-decor-foreground/10 text-[0.6875rem] font-semibold text-decor-foreground/85">
          YK
        </span>
        <p className="min-w-0 flex-1 truncate text-[0.8125rem] text-decor-muted">
          <span className="font-medium text-decor-foreground">Yasmine</span> a ajouté un document
        </p>
        <span className="shrink-0 text-[0.6875rem] text-decor-subtle">il y a 2 min</span>
      </Glass>
    </div>
  );
}

// Liens vers les pages légales : sous le formulaire (téléphone, tablette) ou
// en bas du panneau de gauche (écran large)
function LegalNav({ className }: { className?: string }) {
  return (
    <nav aria-label="Pages légales" className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}>
      {LEGAL_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="touch-target">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

// Page d'authentification : panneau de présentation à gauche (écrans larges),
// formulaire à droite. Sur mobile, seul le formulaire est affiché, calé en
// haut de l'écran (centré, il flottait sous un grand vide et sautait à
// l'ouverture du clavier).
// Écrans larges : la page a exactement la hauteur de la fenêtre. La colonne
// du formulaire n'a ni barre du haut (le bouton de thème est posé dans le
// coin) ni liens légaux (ils sont dans le panneau de gauche) : sur un
// portable courant, tout tient sans barre de défilement. Elle ne défile
// que sur une fenêtre trop basse.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:overflow-hidden">
      <aside className="relative hidden overflow-hidden border-r bg-decor p-8 text-decor-foreground lg:flex lg:flex-col xl:p-12 dark:border-transparent xl:[@media(max-height:800px)]:p-10">
        {/* Halo et quadrillage discret, estompés vers les bords */}
        <DecorLayers glowClassName="-top-64 size-[58rem]" />

        {/* Logo : retour à la page d'accueil */}
        <Link href="/" className="relative flex w-fit items-center gap-3 rounded-xl focus-visible:ring-3 focus-visible:ring-decor-foreground/30 focus-visible:outline-none">
          <LogoMark className="size-10 shadow-none" />
          <span className="font-brand text-xl font-bold tracking-tight">{BRAND.name}</span>
        </Link>

        <div className="relative my-auto py-8 [@media(max-height:800px)]:py-4">
          <h2 className="max-w-md text-4xl leading-[1.1] font-semibold tracking-tight text-balance">
            Gérez votre agence, pas vos classeurs.
          </h2>
          <p className="mt-4 max-w-md text-base text-decor-muted">
            Pièces, lettres, formations, paiements et échéances réunis dans un seul
            outil, pour toute l&apos;équipe.
          </p>
          {/* Fenêtre peu haute (portable) : l'aperçu est réduit pour tenir sans
              barre de défilement ; masqué seulement sur une très petite fenêtre */}
          <div className="mt-10 [@media(max-height:800px)]:mt-6 [@media(max-height:760px)]:[zoom:0.85] [@media(max-height:640px)]:hidden">
            <AppPreview />
          </div>
        </div>

        <div className="relative space-y-2.5 text-xs whitespace-nowrap text-decor-subtle">
          <div className="flex items-center justify-between gap-x-6">
            <span className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5" /> Données isolées par agence
              </span>
              <span className="flex items-center gap-1.5">
                <LockKeyhole className="size-3.5" /> Identifiants chiffrés
              </span>
            </span>
            {/* Panneau étroit (petit portable) : les deux garanties suffisent */}
            <span className="hidden xl:inline">© {new Date().getFullYear()} {BRAND.name}</span>
          </div>
          <LegalNav className="text-decor-subtle [&_a:hover]:text-decor-foreground" />
        </div>
      </aside>

      <main className="relative flex min-h-dvh flex-col bg-background px-5 py-5 sm:px-10 lg:min-h-0 lg:overflow-y-auto lg:py-6">
        {/* Téléphone et tablette : logo et thème en haut. Écran large : le
            logo est dans le panneau de gauche, le thème passe dans le coin */}
        <div className="flex items-center justify-between lg:absolute lg:top-4 lg:right-5 lg:z-10">
          <Link href="/" className="flex items-center gap-2.5 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none lg:hidden">
            <LogoMark />
            <span className="font-brand text-lg font-bold tracking-tight">{BRAND.name}</span>
          </Link>
          <ThemeToggle className="size-9 rounded-xl text-muted-foreground" />
        </div>

        <div className="mx-auto flex w-full max-w-100 flex-1 flex-col pt-8 pb-6 sm:justify-center sm:py-8 lg:py-0">
          {children}
        </div>
        <LegalNav className="justify-center pb-1 text-muted-foreground lg:hidden [&_a:hover]:text-foreground" />
      </main>
    </div>
  );
}
