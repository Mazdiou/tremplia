import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Member } from "@/lib/auth/require-member";
import type { StudentSession } from "@/features/student/server/session";
import {
  DEFAULT_PREFERENCES,
  TEST_DELAY_SECONDS,
  type NotificationPreferences,
  type PushSubscriptionInput,
} from "../schemas";
import { testPush } from "../texts";
import { pushConfigured, pushInBackground, sendPush, type PushTarget } from "./push";
import { reportError } from "@/lib/report-error";

// Appareils abonnés et choix de chaque membre. Clé secrète : toujours filtrés
// sur le membre ou le dossier de la session, jamais sur une valeur de la
// requête (sauf l'adresse de l'appareil, qui ne donne accès à rien d'autre).

const NOT_CONFIGURED = "Les notifications ne sont pas encore disponibles";

function assertConfigured() {
  if (!pushConfigured()) throw new ApiError(503, NOT_CONFIGURED);
}

async function saveDevice(
  owner: { agencyId: string; userId: string | null; caseId: string | null; generation: number | null },
  sub: PushSubscriptionInput,
) {
  assertConfigured();
  const { error } = await createAdminClient().rpc("save_push_subscription", {
    p_agency_id: owner.agencyId,
    p_user_id: owner.userId,
    p_case_id: owner.caseId,
    p_generation: owner.generation,
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
  });
  if (error) {
    throw dbError("push device save", error, {
      "42501": owner.userId ? "Accès refusé" : "Votre accès a été fermé par l'agence",
      "23514": "Cet appareil n'a pas pu être activé. Réessayez.",
    });
  }
}

// Membres

export function saveMemberDevice(member: Member, sub: PushSubscriptionInput) {
  return saveDevice(
    { agencyId: member.agencyId, userId: member.userId, caseId: null, generation: null },
    sub,
  );
}

export async function removeMemberDevice(member: Member, endpoint: string) {
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", member.userId);
  if (error) throw dbError("push device remove", error);
}

// Après « déconnecter les autres appareils » : seul celui-ci (s'il est
// abonné) garde les notifications
export async function removeOtherMemberDevices(member: Member, keep: string | null) {
  let query = createAdminClient().from("push_subscriptions").delete().eq("user_id", member.userId);
  if (keep) query = query.neq("endpoint", keep);
  const { error } = await query;
  if (error) throw dbError("push devices remove", error);
}

// Appareils d'un membre (mot de passe temporaire donné par le patron : ses
// appareils ne reçoivent plus rien, il les réactive après connexion)
export async function removeAllDevicesOf(agencyId: string, userId: string) {
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("agency_id", agencyId);
  if (error) throw dbError("push devices remove", error);
}

async function memberDevice(member: Member, endpoint: string) {
  const { data, error } = await createAdminClient()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("endpoint", endpoint)
    .eq("user_id", member.userId)
    .maybeSingle();
  if (error) throw dbError("push device read", error);
  return data as PushTarget | null;
}

export async function isMemberDevice(member: Member, endpoint: string) {
  return (await memberDevice(member, endpoint)) !== null;
}

// Essai, vers cet appareil seulement. Différé : réponse tout de suite, envoi
// TEST_DELAY_SECONDS plus tard (le résultat n'est alors plus connu de la page).
async function sendTest(device: PushTarget | null, student: boolean, delayed: boolean) {
  assertConfigured();
  // reactivate : le bouton « Activer » revient
  if (!device) {
    throw new ApiError(404, "Notifications non activées sur cet appareil", { reactivate: true });
  }
  if (delayed) {
    pushInBackground("push test delayed", async () => {
      await new Promise((resolve) => setTimeout(resolve, TEST_DELAY_SECONDS * 1000));
      await sendPush([device], testPush(student));
    });
    return;
  }
  const result = await sendPush([device], testPush(student));
  if (result.removed > 0) {
    throw new ApiError(410, "Cet appareil n'accepte plus les notifications : réactivez-les", {
      reactivate: true,
    });
  }
  if (result.sent === 0) throw new ApiError(502, "Envoi impossible pour le moment, réessayez");
}

export async function sendTestPush(member: Member, endpoint: string, delayed = false) {
  return sendTest(await memberDevice(member, endpoint), false, delayed);
}

export async function sendStudentTestPush(
  session: StudentSession,
  endpoint: string,
  delayed = false,
) {
  const { data, error } = await createAdminClient()
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("endpoint", endpoint)
    .eq("case_id", session.caseId)
    .eq("agency_id", session.agencyId)
    .eq("student_generation", session.generation)
    .maybeSingle();
  if (error) throw dbError("push device read", error);
  return sendTest(data as PushTarget | null, true, delayed);
}

export async function getPreferences(member: Member): Promise<NotificationPreferences> {
  const { data, error } = await createAdminClient()
    .from("notification_preferences")
    .select("student_messages, student_reviews, student_documents, assigned_tasks, daily_tasks")
    .eq("user_id", member.userId)
    .eq("agency_id", member.agencyId)
    .maybeSingle();
  // Jamais d'erreur : la page Réglages s'affiche quand même
  if (error) {
    reportError("[push preferences read]", error.code);
    return DEFAULT_PREFERENCES;
  }
  if (!data) return DEFAULT_PREFERENCES;
  return {
    studentMessages: data.student_messages as boolean,
    studentReviews: data.student_reviews as boolean,
    studentDocuments: data.student_documents as boolean,
    assignedTasks: data.assigned_tasks as boolean,
    dailyTasks: data.daily_tasks as boolean,
  };
}

export async function savePreferences(member: Member, prefs: NotificationPreferences) {
  const { error } = await createAdminClient().rpc("save_notification_preferences", {
    p_agency_id: member.agencyId,
    p_user_id: member.userId,
    p_student_messages: prefs.studentMessages,
    p_student_reviews: prefs.studentReviews,
    p_student_documents: prefs.studentDocuments,
    p_assigned_tasks: prefs.assignedTasks,
    p_daily_tasks: prefs.dailyTasks,
  });
  if (error) throw dbError("push preferences save", error, { "42501": "Accès refusé" });
}

// Candidat

export function saveStudentDevice(session: StudentSession, sub: PushSubscriptionInput) {
  return saveDevice(
    {
      agencyId: session.agencyId,
      userId: null,
      caseId: session.caseId,
      generation: session.generation,
    },
    sub,
  );
}

export async function removeStudentDevice(session: StudentSession, endpoint: string) {
  const { error } = await createAdminClient()
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("case_id", session.caseId)
    .eq("agency_id", session.agencyId);
  if (error) throw dbError("push device remove", error);
}

// Abonné pour l'accès en cours (un ancien code ne compte pas)
export async function isStudentDevice(session: StudentSession, endpoint: string) {
  const { data, error } = await createAdminClient()
    .from("push_subscriptions")
    .select("id")
    .eq("endpoint", endpoint)
    .eq("case_id", session.caseId)
    .eq("agency_id", session.agencyId)
    .eq("student_generation", session.generation)
    .maybeSingle();
  if (error) throw dbError("push device read", error);
  return data !== null;
}
