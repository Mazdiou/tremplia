import type { Metadata } from "next";

// Titre de l'onglet et description pour les moteurs de recherche : la page,
// interactive, ne peut pas les déclarer elle-même
export const metadata: Metadata = {
  title: "Inscrire mon agence",
  description: "Inscrivez votre agence en deux étapes : 7 jours d'essai gratuit, sans engagement.",
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
