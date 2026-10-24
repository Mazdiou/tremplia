import type { Metadata } from "next";

// Titre de l'onglet : la page, interactive, ne peut pas le déclarer elle-même
export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
