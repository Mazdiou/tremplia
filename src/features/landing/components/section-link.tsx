"use client";

import type { ComponentProps, MouseEvent } from "react";
import Link from "next/link";

// Marge minimale entre l'en-tête fixe et le contenu d'une section
const GAP = 24;

// Fait défiler jusqu'à la section `id` en centrant son contenu (sans les
// marges de la section) dans la zone visible sous l'en-tête. Trop haut pour
// tenir à l'écran, le contenu se cale juste sous l'en-tête.
export function scrollToSection(id: string, behavior: ScrollBehavior = "smooth") {
  const section = document.getElementById(id);
  const content = section?.firstElementChild;
  if (!section || !content) return false;
  const headerHeight = document.getElementById("landing-header")?.offsetHeight ?? 0;
  const available = window.innerHeight - headerHeight;
  const rect = content.getBoundingClientRect();
  const offset = Math.max(GAP, (available - rect.height) / 2);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({
    top: window.scrollY + rect.top - headerHeight - offset,
    behavior: reduce ? "auto" : behavior,
  });
  return true;
}

// Lien vers une section de la page d'accueil. Reste un Link (le retour arrière
// depuis une autre page doit retrouver la page), mais le défilement est le nôtre.
export function SectionLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: `#${string}` }) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (!event.defaultPrevented) scrollToSection(href.slice(1));
  }
  return <Link href={href} scroll={false} onClick={handleClick} {...props} />;
}
