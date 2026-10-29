import "server-only";
import type { z } from "zod";
import { dbError } from "@/lib/api-errors";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import { notifyStudentRequest } from "@/features/notifications/server/events";
import {
  MAX_REQUESTS_PER_CASE,
  type acceptRequestSchema,
  type documentRequestSchema,
} from "../schemas";

// Pièces demandées au candidat, côté agence : tout membre actif. Les
// fonctions SQL revérifient le membre et que la pièce est bien celle de ce
// dossier ; l'abonnement expiré est refusé par la base (25006).

type RequestInput = z.infer<typeof documentRequestSchema>;

const REQUEST_ERRORS = {
  "23505": "Cette pièce est déjà demandée",
  // Le dossier de rangement n'est pas un dossier de ce candidat
  "23503": "Cette catégorie n'existe plus",
  P0002: "Pièce introuvable",
};

export async function createRequest(auth: AuthorizedCase, caseId: string, input: RequestInput) {
  const { data, error } = await auth.admin.rpc("create_document_request", {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_label: input.label,
    p_folder_id: input.folderId,
  });
  if (error) {
    throw dbError("document requests create", error, {
      ...REQUEST_ERRORS,
      P0002: "Dossier introuvable",
      "54000": `${MAX_REQUESTS_PER_CASE} pièces au maximum par candidat`,
    });
  }

  const id = data as string;
  await logCaseActivity(auth, caseId, {
    action: "document_request.created",
    targetType: "document_request",
    targetId: id,
  });
  // Rien n'arrive au candidat tant que son accès est fermé
  notifyStudentRequest(auth.agencyId, caseId, input.label);
  return id;
}

// Nom ou dossier de rangement (pour les prochains envois)
export async function updateRequest(
  auth: AuthorizedCase,
  caseId: string,
  requestId: string,
  input: RequestInput,
) {
  const { data, error } = await auth.admin.rpc("update_document_request", {
    p_request_id: requestId,
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_label: input.label,
    p_folder_id: input.folderId,
  });
  if (error) throw dbError("document requests update", error, REQUEST_ERRORS);

  if (data === true) {
    await logCaseActivity(auth, caseId, {
      action: "document_request.updated",
      targetType: "document_request",
      targetId: requestId,
    });
  }
}

// Le document déjà reçu reste dans les documents du dossier
export async function deleteRequest(auth: AuthorizedCase, caseId: string, requestId: string) {
  const { error } = await auth.admin.rpc("delete_document_request", {
    p_request_id: requestId,
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
  });
  if (error) throw dbError("document requests delete", error, REQUEST_ERRORS);

  await logCaseActivity(auth, caseId, {
    action: "document_request.deleted",
    targetType: "document_request",
    targetId: requestId,
  });
}

// Acceptée, la pièce ne peut plus être remplacée ni retirée par le candidat
export async function setRequestAccepted(
  auth: AuthorizedCase,
  caseId: string,
  requestId: string,
  input: z.infer<typeof acceptRequestSchema>,
) {
  const { data, error } = await auth.admin.rpc("set_document_request_accepted", {
    p_request_id: requestId,
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_document_id: input.documentId,
    p_accepted: input.accepted,
  });
  if (error) {
    throw dbError("document requests accept", error, {
      ...REQUEST_ERRORS,
      "55000": "Le candidat vient de changer cette pièce : vérifiez le nouveau document",
      "23514": "Cette pièce n'a pas encore été reçue",
    });
  }

  if (data === true) {
    await logCaseActivity(auth, caseId, {
      action: input.accepted ? "document_request.accepted" : "document_request.unaccepted",
      targetType: "document_request",
      targetId: requestId,
      details: { document_id: input.documentId },
    });
  }
}
