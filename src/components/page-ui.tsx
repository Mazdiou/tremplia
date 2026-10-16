import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Briques d'interface partagées : conteneur et en-tête de page, cartes,
// sections de formulaire, lignes clé/valeur, pastilles.

const WIDTHS = {
  narrow: "max-w-3xl",
  default: "max-w-5xl",
  wide: "max-w-6xl",
} as const;

// Largeur et marges d'une page, identiques partout
export function PageContainer({
  width = "default",
  className,
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full space-y-6 px-4 py-6 md:px-8 md:py-8", WIDTHS[width], className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  // Petite ligne au-dessus du titre (fil d'Ariane, rubrique…)
  eyebrow?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-sm text-muted-foreground">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  highlight,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  highlight?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-card",
        highlight && "border-primary/40 bg-highlight",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

// Section de formulaire : titre et explication à gauche, champs à droite
// (empilés sur téléphone).
export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 border-b pb-8 last:border-b-0 md:grid-cols-[14rem_1fr] md:gap-8">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="min-w-0 space-y-5 rounded-2xl border bg-card p-5">{children}</div>
    </section>
  );
}

// Barre d'actions qui reste visible en bas de l'écran pendant la saisie
export function FormActions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border bg-card/95 px-4 py-3 shadow-sm backdrop-blur">
      {children}
    </div>
  );
}

export function KeyRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    // Téléphone : libellé au-dessus de la valeur, qui garde toute la largeur
    <div className="flex flex-col gap-0.5 border-b px-5 py-3 text-sm last:border-b-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium sm:text-right">{children}</dd>
    </div>
  );
}

// Avec `href`, la carte entière mène à la liste correspondante
export function StatCard({
  label,
  value,
  hint,
  href,
  className,
}: {
  label: string;
  value: number;
  hint?: string;
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </>
  );
  const base = "rounded-2xl border bg-card px-5 py-4";
  return href ? (
    <Link
      href={href}
      className={cn(
        base,
        "block transition-colors hover:border-primary/40 hover:bg-highlight/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      {body}
    </Link>
  ) : (
    <div className={cn(base, className)}>{body}</div>
  );
}

// warn : à surveiller (reste à payer…), sans l'alarme du rouge
export type PillTone = "ok" | "off" | "bad" | "info" | "warn";

// Couleurs des pastilles, partagées avec les sélecteurs qui en ont l'aspect
export const PILL_TONE_CLASSES: Record<PillTone, string> = {
  ok: "bg-success-bg text-success",
  off: "bg-muted text-muted-foreground",
  bad: "bg-destructive/10 text-destructive",
  info: "bg-accent text-accent-foreground",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
};

// Élément d'un menu déroulant (« … » d'une campagne, actions d'un dossier,
// messages WhatsApp)
export const MENU_ITEM_CLASS =
  "block w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none";

export function StatusPill({
  tone,
  children,
}: {
  tone: PillTone;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        PILL_TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}

// Résultat de la dernière action d'un panneau (« Note ajoutée », erreur…)
export type ActionMessage = { text: string; error: boolean } | null;

// Ligne réservée sous les actions : rien ne bouge quand un message apparaît
export function StatusMessage({
  message,
  className,
}: {
  message: ActionMessage;
  className?: string;
}) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "min-h-5 px-1 text-sm",
        message?.error ? "text-destructive" : "text-muted-foreground",
        className,
      )}
    >
      {message?.text}
    </p>
  );
}

export function NewCaseLink({
  className,
  campaignId,
}: {
  className?: string;
  campaignId?: string;
}) {
  return (
    <Link
      href={campaignId ? `/cases/new?campaign=${campaignId}` : "/cases/new"}
      className={buttonVariants({ className })}
    >
      <Plus /> Nouveau dossier
    </Link>
  );
}
