import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/auth/auth-shell";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page introuvable · StudyFlow" };

// Toute adresse inconnue (faute de frappe, ancien lien). L'accueil renvoie
// ensuite au bon endroit : tableau de bord, ou connexion si besoin.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <LogoMark className="size-11" />
      <p className="mt-6 text-sm font-medium text-muted-foreground">Erreur 404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        L&apos;adresse est peut-être mal tapée, ou cette page n&apos;existe plus.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-6" })}>
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
