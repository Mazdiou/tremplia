import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BRAND } from "@/config/brand";
import { LEGAL, LEGAL_LINKS } from "@/config/legal";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { formatLongDate } from "@/lib/dates";

// Mise en page des pages légales : texte long, lisible, ouvert à tous (avec
// ou sans connexion).

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <LogoMark />
            <span className="font-brand text-lg font-bold tracking-tight">{BRAND.name}</span>
          </Link>
          <ThemeToggle className="size-9 rounded-xl text-muted-foreground" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
        <Link
          href="/"
          className="touch-target mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Accueil
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : {formatLongDate(LEGAL.updatedAt)}
        </p>
        <div className="mt-8 space-y-10">{children}</div>
      </main>

      <footer className="border-t px-5 py-8 sm:px-8">
        <nav
          aria-label="Pages légales"
          className="mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
        >
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="py-1 hover:text-foreground">
              {l.label}
            </Link>
          ))}
          <a href={`mailto:${LEGAL.contact}`} className="py-1 hover:text-foreground">
            {LEGAL.contact}
          </a>
        </nav>
      </footer>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 text-[15px] leading-7 text-foreground/90">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export function ContactLink() {
  return (
    <a href={`mailto:${LEGAL.contact}`} className="font-medium text-link underline underline-offset-2">
      {LEGAL.contact}
    </a>
  );
}
