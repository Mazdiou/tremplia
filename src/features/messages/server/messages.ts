import "server-only";
import { cache } from "react";
import { ApiError, dbError, rateLimited } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { STUDENT_READ_ONLY } from "@/features/subscription/subscription";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import type { StudentSession } from "@/features/student/server/session";
import type { MessageItem } from "@/features/messages/schemas";
import { memberNames } from "@/features/team/server/members";
import { notifyStudent, notifyStudentMessage } from "@/features/notifications/server/events";
import { reportError } from "@/lib/report-error";

// Conversation d'un dossier entre le candidat et l'agence. Lectures avec la
// clé secrète, toujours filtrées sur l'agence (et le dossier) de la session.
// Le contenu des messages n'est jamais écrit dans le journal ni les logs.

const MAX_SHOWN = 300;

export async function listMessages(agencyId: string, caseId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("case_messages")
    .select("id, sender, kind, body, created_at, author_id")
    .eq("case_id", caseId)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(MAX_SHOWN);
  if (error) reportError("[messages read]", error.code);
  const rows = (data ?? []).reverse() as {
    id: string;
    sender: MessageItem["sender"];
    kind: MessageItem["kind"];
    body: string;
    created_at: string;
    author_id: string | null;
  }[];

  const names = await memberNames(
    admin,
    [...new Set(rows.flatMap((r) => (r.author_id ? [r.author_id] : [])))],
    agencyId,
  );

  return rows.map(
    (r): MessageItem => ({
      id: r.id,
      sender: r.sender,
      kind: r.kind,
      body: r.body,
      createdAt: r.created_at,
      authorName: r.author_id ? (names.get(r.author_id) ?? "Un ancien membre") : null,
    }),
  );
}

// Dernier message de la conversation : la page n'est relue que s'il change
export async function latestMessageId(agencyId: string, caseId: string) {
  const { data, error } = await createAdminClient()
    .from("case_messages")
    .select("id")
    .eq("case_id", caseId)
    .eq("agency_id", agencyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw dbError("messages latest", error);
  return (data?.id as string | undefined) ?? null;
}

// Côté agence -----------------------------------------------------------------

export async function sendAgencyMessage(auth: AuthorizedCase, caseId: string, body: string) {
  const { data, error } = await auth.admin.rpc("send_agency_message", {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_body: body,
  });
  if (error) {
    throw dbError("messages send", error, {
      P0002: "Dossier introuvable",
      "23514": "Message invalide",
    });
  }
  if (typeof data !== "string") throw new ApiError(500, "Impossible d'envoyer le message");

  await logCaseActivity(auth, caseId, {
    action: "message.sent",
    targetType: "case_message",
    targetId: data,
  });
  notifyStudent(auth.agencyId, caseId, body);
}

export async function markReadByAgency(auth: AuthorizedCase, caseId: string) {
  const { error } = await auth.admin.rpc("mark_messages_read_agency", {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
  });
  if (error) throw dbError("messages read mark", error);
}

// Messages du candidat non lus par l'agence, par dossier. Mis en cache pour
// la durée d'un affichage : la liste des dossiers et le dossier ouvert
// partagent la même lecture.
export const agencyUnreadCounts = cache(async (agencyId: string): Promise<Record<string, number>> => {
  const { data, error } = await createAdminClient().rpc("agency_unread_messages", {
    p_agency_id: agencyId,
  });
  if (error) {
    reportError("[messages unread]", error.code);
    return {};
  }
  return Object.fromEntries(
    ((data ?? []) as { case_id: string; unread: number }[]).map((r) => [
      r.case_id,
      Number(r.unread),
    ]),
  );
});

// Côté candidat -------------------------------------------------------------

export async function sendStudentMessage(session: StudentSession, body: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("send_student_message", {
    p_case_id: session.caseId,
    p_agency_id: session.agencyId,
    p_generation: session.generation,
    p_body: body,
  });
  if (error) {
    throw (
      rateLimited(error, "Vous avez envoyé beaucoup de messages : réessayez dans une heure") ??
      dbError("student message send", error, {
        "42501": "Votre accès a été fermé par l'agence",
        "25006": STUDENT_READ_ONLY,
        "23514": "Message invalide",
      })
    );
  }
  if (typeof data !== "string") throw new ApiError(500, "Impossible d'envoyer le message");

  await logActivity(admin, {
    agencyId: session.agencyId,
    actorId: null,
    action: "student.message_sent",
    targetType: "case_message",
    targetId: data,
    caseId: session.caseId,
  });
  notifyStudentMessage(session.agencyId, session.caseId, body);
}

export async function markReadByStudent(session: StudentSession) {
  const { error } = await createAdminClient().rpc("mark_messages_read_student", {
    p_case_id: session.caseId,
    p_agency_id: session.agencyId,
    p_generation: session.generation,
  });
  if (error) throw dbError("student messages read mark", error, {
    "42501": "Votre accès a été fermé par l'agence",
  });
}

export async function studentUnreadCount(session: StudentSession) {
  const { data, error } = await createAdminClient().rpc("student_unread_messages", {
    p_case_id: session.caseId,
    p_agency_id: session.agencyId,
  });
  if (error) {
    reportError("[student messages unread]", error.code);
    return 0;
  }
  return Number(data ?? 0);
}
