import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { CASE_FIELD_COLUMNS, type CaseFieldsRecord } from "@/features/cases/case-record";
import type { ProgramItem } from "@/features/programs/components/programs-panel";
import { getStudentSession, type StudentSession } from "./session";

// Lectures de l'espace candidat. Le candidat n'a pas de compte Supabase :
// lecture avec la clé secrète, toujours filtrée sur le dossier et l'agence
// de sa session (jamais sur une valeur de la requête).

// Session valide, sinon retour à la page de connexion
export async function requireStudent(): Promise<StudentSession> {
  const session = await getStudentSession();
  if (!session) redirect("/student/login");
  return session;
}

export const getStudentCase = cache(async () => {
  const { caseId, agencyId } = await requireStudent();
  const admin = createAdminClient();
  const [caseRes, agencyRes] = await Promise.all([
    admin
      .from("cases")
      .select(CASE_FIELD_COLUMNS.join(", "))
      .eq("id", caseId)
      .eq("agency_id", agencyId)
      .maybeSingle(),
    admin.from("agencies").select("name, phone").eq("id", agencyId).maybeSingle(),
  ]);
  if (caseRes.error || agencyRes.error || !caseRes.data || !agencyRes.data) {
    console.error("[student case]", caseRes.error?.code ?? agencyRes.error?.code ?? "absent");
    redirect("/student/login");
  }
  return {
    c: caseRes.data as unknown as CaseFieldsRecord,
    agency: agencyRes.data as { name: string; phone: string },
  };
});

export async function getStudentLetter() {
  const { caseId, agencyId } = await requireStudent();
  const { data, error } = await createAdminClient()
    .from("case_motivation_letters")
    .select("content, updated_at")
    .eq("case_id", caseId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (error) console.error("[student letter]", error.code);
  return data as { content: string; updated_at: string } | null;
}

export async function getStudentPrograms() {
  const { caseId, agencyId } = await requireStudent();
  const { data, error } = await createAdminClient()
    .from("case_programs")
    .select("id, title, level, city, institution, result")
    .eq("case_id", caseId)
    .eq("agency_id", agencyId)
    .order("position");
  if (error) console.error("[student programs]", error.code);
  return (data ?? []) as ProgramItem[];
}
