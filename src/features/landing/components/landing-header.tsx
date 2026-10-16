"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/config/brand";
import { cn } from "@/lib/utils";

const SECTIONS = [
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#candidats", label: "Espace candidat" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#faq", label: "FAQ" },
];

// En-tête fixe de la page d'accueil. Tant que l'accroche (`heroId`) passe
// dessous, il reste transparent (texte blanc sur fond bleu) ; ensuite, il
// prend les couleurs du thème (clair ou sombre), comme le reste de la page.
export function LandingHeader({ heroId }: { heroId: string }) {
  const [overHero, setOverHero] = useState(true);

  useEffect(() => {
    const hero = document.getElementById(heroId);
    const header = document.getElementById("landing-header");
    if (!hero || !header) return;
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
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" strokeWidth={1.8} />
          </span>
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>
        {/* Liens par le routeur (Link) : avec un simple <a href="#…">, le retour
            arrière depuis une autre page changerait l'adresse sans la page */}
        <nav aria-label="Sections" className="hidden items-center gap-1 text-sm md:flex">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className={cn("rounded-lg px-3 py-2.5 transition-colors", link)}>
              {s.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className={cn("size-9 rounded-xl", link)} />
          <Link
            href="/login"
            className={cn("hidden rounded-lg px-3 py-2.5 text-sm font-medium transition-colors sm:block", link)}
          >
            Se connecter
          </Link>
          <Link href="/register" className={buttonVariants()}>
            Essai gratuit
          </Link>
        </div>
      </div>
    </header>
  );
}
