import type { Metadata } from "next";

// Titre de l'onglet et description pour les moteurs de recherche : la page,
// interactive, ne peut pas les déclarer elle-même
export const metadata: Metadata = {
  title: "Créer mon agence",
  description: "Créez votre agence en deux minutes : 7 jours d'essai gratuit, sans carte bancaire ni engagement.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
