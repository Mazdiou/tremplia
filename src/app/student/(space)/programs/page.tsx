import { GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import {
  ProgramResultPill,
  ProgramRow,
} from "@/features/programs/components/programs-panel";
import { programResult } from "@/features/programs/schemas";
import { getStudentPrograms } from "@/features/student/server/student-case";
import { plural } from "@/lib/plural";

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
        {plural(programs.length, "formation")}, de votre
        préférée à la moins souhaitée.
      </p>
      <ol className="divide-y rounded-xl border bg-card">
        {programs.map((p, i) => (
          <ProgramRow
            key={p.id}
            rank={i + 1}
            program={p}
            result={programResult(p.result) === "none" ? null : <ProgramResultPill result={p.result} />}
          />
        ))}
      </ol>
    </div>
  );
}
