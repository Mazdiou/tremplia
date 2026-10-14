import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ProgramRow } from "@/features/programs/components/programs-panel";
import { getStudentPrograms } from "@/features/student/server/student-case";

export default async function StudentProgramsPage() {
  const programs = await getStudentPrograms();

  if (programs.length === 0) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Aucune formation pour le moment"
        description="Votre agence prépare la liste des formations. Elle apparaîtra ici."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {programs.length} formation{programs.length > 1 ? "s" : ""}, de votre
        préférée à la moins souhaitée.
      </p>
      <ol className="divide-y rounded-xl border bg-card">
        {programs.map((p, i) => (
          <ProgramRow key={p.id} rank={i + 1} program={p} />
        ))}
      </ol>
    </div>
  );
}
