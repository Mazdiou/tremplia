import type { Metadata } from "next";

// Titre de l'onglet : la page, interactive, ne peut pas le déclarer elle-même.
// Page utilitaire : jamais dans les résultats des moteurs de recherche.
export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
