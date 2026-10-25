import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStudentSession } from "@/features/student/server/session";

export const metadata: Metadata = {
  title: "Espace candidat",
  description: "Suivez votre dossier d'études à l'étranger avec le code transmis par votre agence.",
  // Installée sur le téléphone : l'appli du candidat, distincte de celle de l'agence
  manifest: "/student/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Mon dossier", statusBarStyle: "default" },
};

// Candidat déjà connecté : directement à son dossier
export default async function StudentLoginLayout({ children }: { children: React.ReactNode }) {
  if (await getStudentSession()) redirect("/student");
  return children;
}
