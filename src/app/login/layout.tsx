import type { Metadata } from "next";

// Titre de l'onglet et description pour les moteurs de recherche : la page,
// interactive, ne peut pas les déclarer elle-même
export const metadata: Metadata = {
  title: "Connexion",
  description: "Connexion à l'espace de votre agence.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
