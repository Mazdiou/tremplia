import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStudentSession } from "@/features/student/server/session";

export const metadata: Metadata = { title: "Espace candidat · StudyFlow" };

// Candidat déjà connecté : directement à son dossier
export default async function StudentLoginLayout({ children }: { children: React.ReactNode }) {
  if (await getStudentSession()) redirect("/student");
  return children;
}
