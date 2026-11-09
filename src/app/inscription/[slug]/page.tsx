import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, MapPin, Phone } from "lucide-react";
import { BRAND } from "@/config/brand";
import { LEGAL_LINKS } from "@/config/legal";
import { LogoMark } from "@/components/logo-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { initialsOf } from "@/lib/names";
import { telHref } from "@/lib/phone";
import { SignupForm } from "@/features/signup/components/signup-form";
import { getSignupPage } from "@/features/signup/server/public";

type Props = { params: Promise<{ slug: string }> };

// Toujours lue au moment de la visite : une page fermée ou une campagne
// retirée se voit tout de suite
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const page = await getSignupPage((await params).slug);
  if (!page) return { title: "Page introuvable", robots: { index: false } };
  return {
    title: { absolute: `Inscription en ligne – ${page.agencyName}` },
    description: `Envoyez votre demande d'inscription à ${page.agencyName} (${page.agencyCity}) pour vos études à l'étranger.`,
    // Page propre à une agence, partagée par elle : hors des moteurs de
    // recherche, comme le reste de l'application
    robots: { index: false, follow: false },
  };
}

// Page publique d'inscription en ligne d'une agence : le candidat envoie
// ses informations, l'agence les reçoit comme une demande à accepter.
export default async function SignupPage({ params }: Props) {
  const { slug } = await params;
  const page = await getSignupPage(slug);
  if (!page) notFound();

  const [first = "", ...rest] = page.agencyName.split(/\s+/);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Inscription en ligne</span>
          <ThemeToggle className="size-9 rounded-xl text-muted-foreground" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-8 md:py-10">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-base font-semibold text-primary"
          >
            {initialsOf(first, rest.join(" ") || first.slice(1))}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight break-words">{page.agencyName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {page.agencyCity}
              </span>
              <a
                href={telHref(page.agencyPhone)}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Phone className="size-3.5" aria-hidden />
                {page.agencyPhone}
              </a>
            </p>
          </div>
        </div>

        {page.open ? (
          <SignupForm
            slug={slug}
            agencyName={page.agencyName}
            agencyPhone={page.agencyPhone}
            campaigns={page.campaigns}
          />
        ) : (
          <div className="mt-8 rounded-2xl border bg-card p-6 text-center">
            <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <p className="mt-3 font-medium">Les inscriptions en ligne sont fermées pour le moment.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Contactez directement {page.agencyName} au{" "}
              <a href={telHref(page.agencyPhone)} className="font-medium text-link hover:underline">
                {page.agencyPhone}
              </a>
              .
            </p>
          </div>
        )}
      </main>

      <footer className="border-t px-4 py-6 md:px-8">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-6 gap-y-3 text-sm text-muted-foreground">
          <Link href="/" className="flex items-center gap-2 hover:text-foreground">
            <LogoMark className="size-6" />
            <span>
              Formulaire proposé par <span className="font-brand font-bold">{BRAND.name}</span>
            </span>
          </Link>
          <nav aria-label="Pages légales" className="flex flex-wrap gap-x-4 gap-y-1">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="py-1 hover:text-foreground">
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
