import type { Metadata } from "next";

// Titre de l'onglet : la page, interactive, ne peut pas le déclarer elle-même.
// Page utilitaire : jamais dans les résultats des moteurs de recherche.
export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
