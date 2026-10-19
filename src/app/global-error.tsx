"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Dernier recours : erreur dans la mise en page racine elle-même. Elle
// remplace tout le document, sans les styles de l'application : mise en
// forme minimale, en ligne.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: "0 16px",
        }}
      >
        <main>
          <h1 style={{ fontSize: 24, margin: 0 }}>Une erreur est survenue</h1>
          <p style={{ color: "#666", marginTop: 8 }}>
            Le problème nous a été signalé. Rechargez la page dans un instant.
          </p>
          {/* Rechargement complet voulu : la mise en page racine est en cause */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" style={{ display: "inline-block", marginTop: 16 }}>
            Retour à l&apos;accueil
          </a>
        </main>
      </body>
    </html>
  );
}
