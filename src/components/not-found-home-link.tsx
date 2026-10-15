"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

// Bouton de la page « introuvable » : un candidat retourne à son espace,
// les autres à l'accueil (tableau de bord, ou connexion si besoin)
export function NotFoundHomeLink() {
  const student = /^\/student(\/|$)/.test(usePathname() ?? "");
  return (
    <Link href={student ? "/student" : "/"} className={buttonVariants({ className: "mt-6" })}>
      {student ? "Retour à mon espace" : "Retour à l'accueil"}
    </Link>
  );
}
