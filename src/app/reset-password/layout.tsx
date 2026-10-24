import type { Metadata } from "next";

// Titre de l'onglet : la page, interactive, ne peut pas le déclarer elle-même
export const metadata: Metadata = { title: "Nouveau mot de passe" };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
