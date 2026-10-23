import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Member } from "@/lib/auth/require-member";
import type { StudentSession } from "@/features/student/server/session";
import {
  DEFAULT_PREFERENCES,
  type NotificationPreferences,
  type PushSubscriptionInput,
} from "../schemas";
import { testPush } from "../texts";
import { pushConfigured, sendPush, type PushTarget } from "./push";

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
      "23514": "Appareil refusé par le serveur",
    });
  }
}

// --- Membres -------------------------------------------------------------------

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

// Essai, vers cet appareil seulement
export async function sendTestPush(member: Member, endpoint: string) {
  assertConfigured();
  const device = await memberDevice(member, endpoint);
  // reactivate : le bouton « Activer » revient
  if (!device) {
    throw new ApiError(404, "Notifications non activées sur cet appareil", { reactivate: true });
  }
  const result = await sendPush([device], testPush());
  if (result.removed > 0) {
    throw new ApiError(410, "Cet appareil n'accepte plus les notifications : réactivez-les", {
      reactivate: true,
    });
  }
  if (result.sent === 0) throw new ApiError(502, "Envoi impossible pour le moment, réessayez");
}

export async function getPreferences(member: Member): Promise<NotificationPreferences> {
  const { data, error } = await createAdminClient()
    .from("notification_preferences")
    .select("student_messages, student_reviews, assigned_tasks, daily_tasks")
    .eq("user_id", member.userId)
    .eq("agency_id", member.agencyId)
    .maybeSingle();
  if (error) throw dbError("push preferences read", error);
  if (!data) return DEFAULT_PREFERENCES;
  return {
    studentMessages: data.student_messages as boolean,
    studentReviews: data.student_reviews as boolean,
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
    p_assigned_tasks: prefs.assignedTasks,
    p_daily_tasks: prefs.dailyTasks,
  });
  if (error) throw dbError("push preferences save", error, { "42501": "Accès refusé" });
}

// --- Candidat --------------------------------------------------------------------

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
