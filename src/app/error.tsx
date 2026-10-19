"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { LogoMark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";
import { NotFoundHomeLink } from "@/components/not-found-home-link";

// Page en erreur (agence ou espace candidat) : l'erreur est signalée au suivi
// des erreurs, l'utilisateur peut réessayer sans recharger toute l'application
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 text-center">
      <LogoMark className="size-11" />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Une erreur est survenue</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Le problème nous a été signalé. Réessayez dans un instant ; s&apos;il
        persiste, revenez à l&apos;accueil.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>Réessayer</Button>
        <NotFoundHomeLink variant="outline" />
      </div>
    </main>
  );
}
