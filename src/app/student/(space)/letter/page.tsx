import { FileText } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { dateTimeFormat } from "@/lib/dates";
import { getStudentLetter } from "@/features/student/server/student-case";

export default async function StudentLetterPage() {
  const letter = await getStudentLetter();

  if (!letter || letter.content.trim() === "") {
    return (
      <EmptyState
        icon={FileText}
        title="Votre lettre n'est pas encore prête"
        description="Votre agence la rédige. Elle apparaîtra ici dès qu'elle sera enregistrée."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Dernière mise à jour le {dateTimeFormat.format(new Date(letter.updated_at))}
      </p>
      <article className="rounded-xl border bg-card px-5 py-6 text-[15px] leading-relaxed whitespace-pre-wrap break-words shadow-sm sm:px-10 sm:py-10">
        {letter.content}
      </article>
    </div>
  );
}
