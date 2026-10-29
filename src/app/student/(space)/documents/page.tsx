import { FileUp } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { StudentRequests } from "@/features/document-requests/components/student-requests";
import { listStudentRequests } from "@/features/document-requests/server/student";
import { getStudentCase, requireStudent } from "@/features/student/server/student-case";
import { isReadOnly } from "@/features/subscription/server/subscription";

// Pièces demandées par l'agence : le candidat les envoie depuis ici
export default async function StudentDocumentsPage() {
  const session = await requireStudent();
  const [requests, { agency }, readOnly] = await Promise.all([
    listStudentRequests(session.agencyId, session.caseId),
    getStudentCase(),
    isReadOnly(session.agencyId),
  ]);

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={FileUp}
        title="Aucune pièce demandée pour le moment"
        description={`Les pièces demandées par ${agency.name} apparaîtront ici.`}
      />
    );
  }

  return <StudentRequests requests={requests} agencyName={agency.name} readOnly={readOnly} />;
}
