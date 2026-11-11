"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { LogoMark } from "@/components/logo-mark";
import { cn } from "@/lib/utils";
import { SectionLink, scrollToSection } from "./section-link";

const SECTIONS = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#candidats", label: "Espace candidat" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
] as const;

// En-tête fixe de la page d'accueil. Tant que l'accroche (`heroId`) passe
// dessous, il reste transparent (texte blanc sur fond bleu) ; ensuite, il
// prend les couleurs du thème (clair ou sombre), comme le reste de la page.
export function LandingHeader({ heroId }: { heroId: string }) {
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    const header = document.getElementById("landing-header");
    if (!hero || !header) return;
    // Arrivée sur /#section (lien direct, retour arrière) : même placement
    // qu'au clic dans le menu, après le défilement du routeur
    const arrival = location.hash
      ? requestAnimationFrame(() => scrollToSection(location.hash.slice(1), "auto"))
      : 0;
    let frame = 0;
    function update() {
      frame = 0;
      setOverHero(hero!.getBoundingClientRect().bottom > header!.offsetHeight);
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(arrival);
    };
  }, [heroId]);

  const link = overHero
    ? "text-decor-muted hover:bg-decor-foreground/10 hover:text-decor-foreground"
    : "text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <header
      id="landing-header"
      className={cn(
        "fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,color] duration-300",
        overHero
          ? "border-transparent bg-transparent text-decor-foreground"
          : "border-border bg-background/90 text-foreground backdrop-blur-xl backdrop-saturate-150",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark className="shadow-none" />
          <span className="font-brand text-lg font-bold tracking-tight">{BRAND.name}</span>
        </Link>
        <nav aria-label="Sections" className="hidden items-center gap-1 text-sm lg:flex">
          {SECTIONS.map((s) => (
            <SectionLink key={s.href} href={s.href} className={cn("rounded-lg px-3 py-2.5 whitespace-nowrap transition-colors", link)}>
              {s.label}
            </SectionLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className={cn("size-9 rounded-xl", link)} />
          <Link
            href="/login"
            className={cn("hidden rounded-lg px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:block", link)}
          >
            Se connecter
          </Link>
          <Link href="/register" className={cn(buttonVariants(), "whitespace-nowrap")}>
            Essai gratuit
          </Link>
        </div>
      </div>
    </header>
  );
}
