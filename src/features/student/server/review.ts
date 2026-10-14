import "server-only";
import { dbError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ReviewStatus,
  StudentReview,
  StudentReviewInput,
} from "@/features/student/schemas";
import type { StudentSession } from "./session";

// Réponse du candidat (« Je valide » ou « Demander une modification »).
// student_review revérifie la session (accès ouvert, même génération) au
// moment d'écrire. Le message n'est jamais écrit dans le journal.
export async function submitReview(session: StudentSession, input: StudentReviewInput) {
  const admin = createAdminClient();
  const { data: changed, error } = await admin.rpc("student_review", {
    p_case_id: session.caseId,
    p_agency_id: session.agencyId,
    p_generation: session.generation,
    p_fingerprint: input.fingerprint,
    p_decision: input.decision,
    p_message: input.decision === "changes_requested" ? input.message : null,
  });
  if (error) {
    throw dbError("student review", error, {
      "42501": "Votre accès a été fermé par l'agence",
      "22023": "Votre agence n'a encore rien à vous faire valider",
      "23514": "Message invalide",
      "55000": "Votre agence vient de modifier votre dossier : relisez la nouvelle version",
    });
  }

  if (changed === true) {
    await logActivity(admin, {
      agencyId: session.agencyId,
      actorId: null,
      action: input.decision === "approved" ? "student.approved" : "student.changes_requested",
      targetType: "case",
      targetId: session.caseId,
      caseId: session.caseId,
    });
  }
}

// État de la réponse et dernière demande de modification d'un dossier.
// Lecture avec la clé secrète : filtre sur l'agence de la session (agence
// ou candidat), jamais sur une valeur de la requête.
export async function readReview(agencyId: string, caseId: string): Promise<StudentReview> {
  const admin = createAdminClient();
  const [reviewRes, requestRes] = await Promise.all([
    admin
      .from("case_student_reviews")
      .select("status, responded_at")
      .eq("case_id", caseId)
      .eq("agency_id", agencyId)
      .maybeSingle(),
    admin
      .from("case_messages")
      .select("body, created_at")
      .eq("case_id", caseId)
      .eq("agency_id", agencyId)
      .eq("kind", "change_request")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (reviewRes.error || requestRes.error) {
    console.error("[student review read]", reviewRes.error?.code ?? requestRes.error?.code);
  }
  if (!reviewRes.data) return null;
  const req = requestRes.data as { body: string; created_at: string } | null;
  return {
    status: reviewRes.data.status as ReviewStatus,
    respondedAt: reviewRes.data.responded_at as string | null,
    lastRequest: req ? { body: req.body, createdAt: req.created_at } : null,
  };
}

// Rien à valider tant que l'agence n'a écrit ni lettre ni formation
export async function hasContentToReview(agencyId: string, caseId: string) {
  const admin = createAdminClient();
  const [letterRes, programsRes] = await Promise.all([
    admin
      .from("case_motivation_letters")
      .select("content")
      .eq("case_id", caseId)
      .eq("agency_id", agencyId)
      .maybeSingle(),
    admin
      .from("case_programs")
      .select("id", { count: "exact", head: true })
      .eq("case_id", caseId)
      .eq("agency_id", agencyId),
  ]);
  const letter = (letterRes.data?.content as string | undefined) ?? "";
  return letter.trim() !== "" || (programsRes.count ?? 0) > 0;
}

// Version du contenu affichée au candidat (voir student_content_fingerprint)
export async function contentFingerprint(agencyId: string, caseId: string) {
  const { data, error } = await createAdminClient().rpc("student_content_fingerprint", {
    p_case_id: caseId,
    p_agency_id: agencyId,
  });
  if (error) console.error("[student fingerprint]", error.code);
  return typeof data === "string" ? data : "";
}
