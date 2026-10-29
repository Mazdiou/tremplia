import "server-only";
import type { z } from "zod";
import { ApiError, dbError, rateLimited } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { STUDENT_READ_ONLY } from "@/features/subscription/subscription";
import { DOCUMENTS_BUCKET } from "@/features/documents/schemas";
import { documentPath } from "@/features/documents/format";
import { checkReceivedPdf } from "@/features/documents/server/received-file";
import { notifyStudentDocument } from "@/features/notifications/server/events";
import type { StudentSession } from "@/features/student/server/session";
import { reportError } from "@/lib/report-error";
import type { studentAddDocumentSchema, studentUploadSchema } from "../schemas";

// Pièces envoyées par le candidat depuis son espace. Les fonctions SQL
// revérifient sa session (accès ouvert, même génération) au moment
// d'écrire ; le dossier et l'agence viennent toujours de la session, jamais
// de la requête.

const STUDENT_ERRORS = {
  "42501": "Votre accès a été fermé par l'agence",
  P0002: "Cette pièce n'est plus demandée par votre agence",
  "55006": "Cette pièce a été acceptée par votre agence : elle ne peut plus être changée",
  "22023": "L'envoi a expiré : recommencez",
  "25006": STUDENT_READ_ONLY,
};

function storageOf(admin: ReturnType<typeof createAdminClient>) {
  return admin.storage.from(DOCUMENTS_BUCKET);
}

// Fichiers sans document (envoi abandonné, remplacé ou retiré) : un échec
// laisse un fichier inaccessible, signalé sans bloquer le candidat
async function removeFiles(
  admin: ReturnType<typeof createAdminClient>,
  paths: string[],
  label: string,
) {
  if (paths.length === 0) return;
  const { error } = await storageOf(admin).remove(paths);
  if (error) reportError(`[${label}] fichier`, error.name);
}

// Étape 1 de l'envoi : URL signée vers le stockage pour une pièce demandée
export async function prepareStudentUpload(
  session: StudentSession,
  input: z.infer<typeof studentUploadSchema>,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("student_prepare_document", {
    p_case_id: session.caseId,
    p_agency_id: session.agencyId,
    p_generation: session.generation,
    p_request_id: input.requestId,
  });
  if (error) {
    throw (
      rateLimited(error, "Vous avez envoyé beaucoup de fichiers : réessayez dans une heure") ??
      dbError("student documents prepare", error, STUDENT_ERRORS)
    );
  }
  const row = (data as { document_id: string; stale_paths: string[] }[])[0];
  if (!row) throw new ApiError(500, "Impossible de préparer l'envoi");

  await removeFiles(admin, row.stale_paths, "student documents stale");

  const { data: signed, error: signError } = await storageOf(admin).createSignedUploadUrl(
    documentPath(session.agencyId, session.caseId, row.document_id),
  );
  if (signError || !signed) {
    reportError("[student documents upload-url]", signError?.name ?? "erreur");
    throw new ApiError(500, "Impossible de préparer l'envoi");
  }
  return { documentId: row.document_id, path: signed.path, token: signed.token };
}

// Étape 2 de l'envoi : le fichier est vérifié, puis rattaché à sa pièce.
// Le document remplacé, s'il y en a un, est supprimé.
export async function addStudentDocument(
  session: StudentSession,
  input: z.infer<typeof studentAddDocumentSchema>,
) {
  const admin = createAdminClient();

  // Un envoi préparé pour ce dossier et pas encore confirmé, avant de
  // toucher au fichier : l'identifiant vient de la requête, il ne doit
  // jamais désigner un document déjà enregistré.
  const { data: upload, error: uploadError } = await admin
    .from("student_document_uploads")
    .select("request:case_document_requests(label)")
    .eq("document_id", input.documentId)
    .eq("case_id", session.caseId)
    .eq("agency_id", session.agencyId)
    .is("confirmed_at", null)
    .maybeSingle();
  if (uploadError) throw dbError("student documents upload read", uploadError);
  if (!upload) throw new ApiError(400, STUDENT_ERRORS["22023"]);

  const path = documentPath(session.agencyId, session.caseId, input.documentId);
  const request = upload.request as unknown as { label: string } | null;
  if (!request) {
    // Pièce retirée par l'agence pendant l'envoi
    await removeFiles(admin, [path], "student documents add");
    throw new ApiError(404, STUDENT_ERRORS.P0002);
  }

  const size = await checkReceivedPdf(storageOf(admin), path);

  const { data, error } = await admin.rpc("student_add_document", {
    p_case_id: session.caseId,
    p_agency_id: session.agencyId,
    p_generation: session.generation,
    p_document_id: input.documentId,
    p_original_file_name: input.originalFileName,
    p_size_bytes: size,
  });
  if (error) {
    // 22023 : envoi déjà confirmé entre-temps (le fichier appartient alors
    // à un document) ; sinon le fichier n'est rattaché à rien
    if (error.code !== "22023") await removeFiles(admin, [path], "student documents add");
    throw dbError("student documents add", error, STUDENT_ERRORS);
  }

  const replacedPath = data as string | null;
  await removeFiles(admin, replacedPath ? [replacedPath] : [], "student documents replace");

  await logActivity(admin, {
    agencyId: session.agencyId,
    actorId: null,
    action: replacedPath ? "student.document_replaced" : "student.document_sent",
    targetType: "document",
    targetId: input.documentId,
    caseId: session.caseId,
  });
  notifyStudentDocument(session.agencyId, session.caseId, request.label, replacedPath !== null);
}

// Retrait du document envoyé : la pièce repasse en attente
export async function removeStudentDocument(session: StudentSession, requestId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("student_remove_document", {
    p_case_id: session.caseId,
    p_agency_id: session.agencyId,
    p_generation: session.generation,
    p_request_id: requestId,
  });
  if (error) throw dbError("student documents remove", error, STUDENT_ERRORS);

  const path = data as string | null;
  if (!path) return;
  await removeFiles(admin, [path], "student documents remove");

  await logActivity(admin, {
    agencyId: session.agencyId,
    actorId: null,
    action: "student.document_removed",
    targetType: "document_request",
    targetId: requestId,
    caseId: session.caseId,
  });
}
