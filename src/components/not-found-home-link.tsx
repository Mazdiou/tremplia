"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useBrowserValue } from "@/hooks/use-browser-value";

// Bouton des pages « introuvable » et « erreur » : un candidat retourne à son espace,
// les autres à l'accueil (tableau de bord, ou connexion si besoin).
// L'adresse n'est connue que dans le navigateur (la page est préparée à
// l'avance) : le premier rendu affiche l'accueil, le bon bouton suit.
export function NotFoundHomeLink({ variant }: { variant?: "outline" } = {}) {
  const path = useBrowserValue(() => window.location.pathname);
  const student = /^\/student(\/|$)/.test(path ?? "");
  return (
    <Link href={student ? "/student" : "/"} className={buttonVariants({ variant, className: variant ? undefined : "mt-6" })}>
      {student ? "Retour à mon espace" : "Retour à l'accueil"}
    </Link>
  );
}
