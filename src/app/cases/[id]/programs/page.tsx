import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { getCase } from "@/features/cases/server/get-case";
import { EmptyState } from "@/components/empty-state";

export default async function ProgramsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getCase(id))) notFound();
  return (
    <EmptyState
      icon={GraduationCap}
      title="Les formations arrivent bientôt"
      description="Cet onglet sera disponible dans une prochaine version."
    />
  );
}
