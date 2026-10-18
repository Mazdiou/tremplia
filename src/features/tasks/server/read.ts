import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { fullName } from "@/lib/names";
import type { TaskMember } from "@/features/tasks/types";

// Lectures via le RLS : seules les tâches et les membres de l'agence de la
// session reviennent.

// Membres de l'agence (responsables possibles et noms affichés). En cache
// pour la requête : l'en-tête du dossier et l'onglet Tâches le partagent.
export const listTaskMembers = cache(async (): Promise<TaskMember[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, is_active")
    .order("first_name");
  if (error) console.error("[tasks members]", error.code);
  return ((data ?? []) as { id: string; first_name: string; last_name: string; is_active: boolean }[]).map(
    (p) => ({ id: p.id, name: fullName(p.first_name, p.last_name), isActive: p.is_active }),
  );
});

// Nombre de tâches à faire du dossier (onglet, question à la clôture)
export const countOpenCaseTasks = cache(async (caseId: string): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("case_tasks")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .is("done_at", null);
  if (error) console.error("[tasks count]", error.code);
  return count ?? 0;
});

export type TaskRow = {
  id: string;
  title: string;
  details: string | null;
  due_date: string | null;
  assigned_to: string;
  created_by: string;
  done_at: string | null;
  done_by: string | null;
  created_at: string;
};

const DONE_SHOWN = 50;

// Toutes les tâches à faire (100 au plus), et les dernières faites
export async function listCaseTasks(caseId: string) {
  const supabase = await createClient();
  const columns = "id, title, details, due_date, assigned_to, created_by, done_at, done_by, created_at";
  const [open, done] = await Promise.all([
    supabase.from("case_tasks").select(columns).eq("case_id", caseId).is("done_at", null),
    supabase
      .from("case_tasks")
      .select(columns, { count: "exact" })
      .eq("case_id", caseId)
      .not("done_at", "is", null)
      .order("done_at", { ascending: false })
      .limit(DONE_SHOWN),
  ]);
  if (open.error) console.error("[tasks list open]", open.error.code);
  if (done.error) console.error("[tasks list done]", done.error.code);
  return {
    open: (open.data ?? []) as TaskRow[],
    done: (done.data ?? []) as TaskRow[],
    doneTotal: done.count ?? 0,
  };
}
