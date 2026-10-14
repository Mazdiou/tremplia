import { getStudentCase } from "@/features/student/server/student-case";
import { IdentityPanel, ParcoursPanel } from "@/features/cases/components/case-info-panels";

export default async function StudentInfoPage() {
  const { c, agency } = await getStudentCase();
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Vérifiez vos informations. Si quelque chose est faux, prévenez {agency.name}.
      </p>
      <div className="grid items-start gap-5 md:grid-cols-2">
        <IdentityPanel c={c} />
        <ParcoursPanel c={c} />
      </div>
    </div>
  );
}
