import "server-only";
import { dbError } from "@/lib/api-errors";
import { todayInAppTimezone } from "@/lib/dates";
import { displayName, fullName } from "@/lib/names";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Member } from "@/lib/auth/require-member";
import {
  agencyMessagePush,
  assignedTaskPush,
  assignedTasksPush,
  documentRequestPush,
  onlineSignupPush,
  studentDocumentPush,
  studentMessagePush,
  studentReviewPush,
  taskDigestPush,
  type PushPayload,
} from "../texts";
import { pushConfigured, pushInBackground, sendPush, type PushTarget } from "./push";

// Notifications de chaque événement, envoyées après la réponse (voir
// pushInBackground). Les destinataires viennent de la base au moment
// d'envoyer (migration push_notifications) : membres actifs, selon leurs
// choix, du dossier de l'agence de la session.

type Admin = ReturnType<typeof createAdminClient>;

async function targets(admin: Admin, fn: string, args: Record<string, unknown>) {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw dbError(`push targets ${fn}`, error);
  return (data ?? []) as PushTarget[];
}

async function studentName(admin: Admin, agencyId: string, caseId: string) {
  const { data, error } = await admin
    .from("cases")
    .select("first_name, last_name")
    .eq("id", caseId)
    .eq("agency_id", agencyId)
    .maybeSingle();
  if (error) throw dbError("push case name", error);
  return data ? displayName(data.first_name as string, data.last_name as string) : "Un candidat";
}

// Message d'un candidat : son responsable (ou les patrons)
export function notifyStudentMessage(agencyId: string, caseId: string, body: string) {
  pushInBackground("push student message", async () => {
    const admin = createAdminClient();
    const to = await targets(admin, "push_targets_case", {
      p_agency_id: agencyId,
      p_case_id: caseId,
      p_kind: "student_message",
    });
    if (to.length === 0) return;
    await sendPush(to, studentMessagePush(caseId, await studentName(admin, agencyId, caseId), body));
  });
}

// Réponse d'un candidat sur sa lettre et ses formations
export function notifyStudentReview(
  agencyId: string,
  caseId: string,
  review: { decision: "approved" } | { decision: "changes_requested"; message: string },
) {
  pushInBackground("push student review", async () => {
    const admin = createAdminClient();
    const to = await targets(admin, "push_targets_case", {
      p_agency_id: agencyId,
      p_case_id: caseId,
      p_kind: "student_review",
    });
    if (to.length === 0) return;
    await sendPush(to, studentReviewPush(caseId, await studentName(admin, agencyId, caseId), review));
  });
}

// Pièce envoyée ou remplacée par un candidat (mêmes destinataires que ses
// messages)
export function notifyStudentDocument(
  agencyId: string,
  caseId: string,
  label: string,
  replaced: boolean,
) {
  pushInBackground("push student document", async () => {
    const admin = createAdminClient();
    const to = await targets(admin, "push_targets_case", {
      p_agency_id: agencyId,
      p_case_id: caseId,
      p_kind: "student_document",
    });
    if (to.length === 0) return;
    await sendPush(
      to,
      studentDocumentPush(caseId, await studentName(admin, agencyId, caseId), label, replaced),
    );
  });
}

// Demande reçue sur la page d'inscription en ligne : les membres de l'agence
// qui le veulent
export function notifyOnlineSignup(agencyId: string, signupId: string) {
  pushInBackground("push online signup", async () => {
    const admin = createAdminClient();
    const to = await targets(admin, "push_targets_online_signup", { p_agency_id: agencyId });
    if (to.length === 0) return;
    const { data, error } = await admin
      .from("online_signups")
      .select("fields, campaigns(name)")
      .eq("id", signupId)
      .eq("agency_id", agencyId)
      .maybeSingle();
    if (error) throw dbError("push signup read", error);
    // Déjà acceptée ou refusée : plus rien à signaler
    if (!data) return;
    const fields = data.fields as { first_name: string; last_name: string };
    const campaign = data.campaigns as unknown as { name: string } | null;
    await sendPush(
      to,
      onlineSignupPush(displayName(fields.first_name, fields.last_name), campaign?.name ?? null),
    );
  });
}

// Tâche confiée par un collègue (rien quand on se la donne à soi-même)
export function notifyAssignedTask(
  actor: Member,
  caseId: string,
  task: { id: string; title: string; assignedTo: string },
) {
  if (task.assignedTo === actor.userId) return;
  pushInBackground("push assigned task", async () => {
    const admin = createAdminClient();
    const to = await targets(admin, "push_targets_assigned_task", {
      p_agency_id: actor.agencyId,
      p_user_id: task.assignedTo,
    });
    if (to.length === 0) return;
    await sendPush(
      to,
      assignedTaskPush(
        caseId,
        task,
        fullName(actor.firstName, actor.lastName),
        await studentName(admin, actor.agencyId, caseId),
      ),
    );
  });
}

// Même tâche confiée pour plusieurs dossiers d'un coup
export function notifyAssignedTasks(
  actor: Member,
  task: { title: string; assignedTo: string },
  created: { caseId: string; taskId: string }[],
) {
  if (created.length === 0) return;
  if (created.length === 1) {
    return notifyAssignedTask(actor, created[0].caseId, {
      id: created[0].taskId,
      title: task.title,
      assignedTo: task.assignedTo,
    });
  }
  if (task.assignedTo === actor.userId) return;
  pushInBackground("push assigned tasks", async () => {
    const admin = createAdminClient();
    const to = await targets(admin, "push_targets_assigned_task", {
      p_agency_id: actor.agencyId,
      p_user_id: task.assignedTo,
    });
    if (to.length === 0) return;
    await sendPush(
      to,
      assignedTasksPush(task.title, fullName(actor.firstName, actor.lastName), created.length),
    );
  });
}

// Vers les appareils du candidat (accès en cours seulement), au nom de
// l'agence
function pushToStudent(
  label: string,
  agencyId: string,
  caseId: string,
  payload: (agencyName: string) => PushPayload,
) {
  pushInBackground(label, async () => {
    const admin = createAdminClient();
    const to = await targets(admin, "push_targets_student", {
      p_agency_id: agencyId,
      p_case_id: caseId,
    });
    if (to.length === 0) return;
    const { data, error } = await admin.from("agencies").select("name").eq("id", agencyId).maybeSingle();
    if (error) throw dbError("push agency name", error);
    await sendPush(to, payload((data?.name as string | undefined) ?? "Votre agence"));
  });
}

// Message de l'agence
export function notifyStudent(agencyId: string, caseId: string, body: string) {
  pushToStudent("push student", agencyId, caseId, (name) => agencyMessagePush(name, body));
}

// Pièce demandée par l'agence
export function notifyStudentRequest(agencyId: string, caseId: string, label: string) {
  pushToStudent("push student request", agencyId, caseId, (name) =>
    documentRequestPush(name, label),
  );
}

// Récapitulatif du matin, lancé une fois par jour
// (.github/workflows/taches-quotidiennes.yml). Chaque membre est réservé
// dans la base avant l'envoi : jamais deux récapitulatifs le même jour.
export async function sendTaskDigests() {
  if (!pushConfigured()) return { members: 0, sent: 0, failed: 0, configured: false };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_task_digests", { p_today: todayInAppTimezone() });
  if (error) throw dbError("push digests", error);
  const rows = (data ?? []) as { user_id: string; due_today: number; overdue: number }[];

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const { data: devices, error: devicesError } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", row.user_id);
    if (devicesError) throw dbError("push digest devices", devicesError);
    const result = await sendPush(
      (devices ?? []) as PushTarget[],
      taskDigestPush(row.due_today, row.overdue),
    );
    sent += result.sent;
    failed += result.failed;
  }
  return { members: rows.length, sent, failed, configured: true };
}
