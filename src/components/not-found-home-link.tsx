"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

// L'adresse n'est connue que dans le navigateur : la page « introuvable » est
// préparée à l'avance, sans elle. Le serveur et le premier rendu affichent
// donc l'accueil ; le bon bouton apparaît juste après (sans erreur
// d'hydratation).
const noSubscribe = () => () => {};

// Bouton de la page « introuvable » : un candidat retourne à son espace,
// les autres à l'accueil (tableau de bord, ou connexion si besoin)
export function NotFoundHomeLink() {
  const path = useSyncExternalStore(
    noSubscribe,
    () => window.location.pathname,
    () => null,
  );
  const student = /^\/student(\/|$)/.test(path ?? "");
  return (
    <Link href={student ? "/student" : "/"} className={buttonVariants({ className: "mt-6" })}>
      {student ? "Retour à mon espace" : "Retour à l'accueil"}
    </Link>
  );
}
