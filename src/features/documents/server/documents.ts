import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApiError, dbError } from "@/lib/api-errors";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import { documentPath } from "../format";
import {
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
  type addDocumentSchema,
} from "../schemas";

// Documents PDF d'un dossier. L'appelant est déjà vérifié (authorizeCase) ;
// chaque lecture et écriture filtre aussi sur l'agence de la session. Un
// document verrouillé par le patron est protégé par la base (code 55006).

const LOCKED = (verb: string) =>
  `Ce document est verrouillé par le patron : il ne peut plus être ${verb}`;

// Le document doit appartenir à ce dossier candidat
async function findDocument<T>(
  auth: AuthorizedCase,
  caseId: string,
  docId: string,
  columns: string,
): Promise<T> {
  const { data, error } = await auth.admin
    .from("documents")
    .select(columns)
    .eq("id", docId)
    .eq("case_id", caseId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (error) throw dbError("documents read", error);
  if (!data) throw new ApiError(404, "Document introuvable");
  return data as T;
}

// Étape 1 de l'envoi : URL signée vers le stockage. Le navigateur y envoie
// le PDF directement (la limite de corps de requête de Vercel est d'environ
// 4,5 Mo). Le chemin est construit ici, avec l'agence de la session.
export async function prepareUpload(auth: AuthorizedCase, caseId: string) {
  const documentId = randomUUID();
  const { data, error } = await auth.admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(documentPath(auth.agencyId, caseId, documentId));
  if (error || !data) {
    console.error("[documents upload-url]", error?.name ?? "erreur");
    throw new ApiError(500, "Impossible de préparer l'envoi");
  }
  return { documentId, path: data.path, token: data.token };
}

// Étape 2 de l'envoi : le fichier réellement reçu est vérifié (présent,
// taille, signature PDF) avant de créer la ligne.
export async function addDocument(
  auth: AuthorizedCase,
  caseId: string,
  input: z.infer<typeof addDocumentSchema>,
) {
  const path = documentPath(auth.agencyId, caseId, input.documentId);
  const storage = auth.admin.storage.from(DOCUMENTS_BUCKET);

  const { data: blob, error: downloadError } = await storage.download(path);
  if (downloadError || !blob) {
    throw new ApiError(400, "Le fichier n'a pas été reçu. Réessayez l'envoi.");
  }

  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  const isPdf = new TextDecoder().decode(head) === "%PDF-";
  if (blob.size < 1 || blob.size > MAX_DOCUMENT_BYTES || !isPdf) {
    await storage.remove([path]);
    throw new ApiError(
      400,
      blob.size > MAX_DOCUMENT_BYTES ? "Le fichier dépasse 10 Mo" : "Ce fichier n'est pas un PDF valide",
    );
  }

  const folderId = input.folderId ?? null;
  const { error } = await auth.admin.from("documents").insert({
    id: input.documentId,
    agency_id: auth.agencyId,
    case_id: caseId,
    name: input.name,
    original_file_name: input.originalFileName,
    storage_path: path,
    size_bytes: blob.size,
    uploaded_by: auth.member.userId,
    folder_id: folderId,
  });
  if (error) {
    // 23505 : déjà enregistré. Le fichier appartient alors à ce document :
    // on ne le supprime surtout pas.
    if (error.code !== "23505") await storage.remove([path]);
    throw dbError("documents add", error, {
      "23505": "Ce document est déjà ajouté",
      // Le dossier de rangement n'est pas un dossier de ce candidat
      "23503": "Dossier introuvable",
    });
  }

  await logCaseActivity(auth, caseId, {
    action: "document.added",
    targetType: "document",
    targetId: input.documentId,
    details: { size_bytes: blob.size, folder_id: folderId },
  });
}

// Lien signé valable une minute
export async function documentOpenUrl(auth: AuthorizedCase, caseId: string, docId: string) {
  const doc = await findDocument<{ storage_path: string }>(auth, caseId, docId, "storage_path");
  const { data, error } = await auth.admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(doc.storage_path, 60);
  if (error || !data) {
    console.error("[documents open]", error?.name ?? "erreur");
    throw new ApiError(500, "Impossible d'ouvrir le document");
  }
  return data.signedUrl;
}

export async function renameDocument(
  auth: AuthorizedCase,
  caseId: string,
  docId: string,
  name: string,
) {
  const { data, error } = await auth.admin
    .from("documents")
    .update({ name })
    .eq("id", docId)
    .eq("case_id", caseId)
    .eq("agency_id", auth.agencyId)
    .select("id")
    .maybeSingle();
  if (error) throw dbError("documents rename", error, { "55006": LOCKED("renommé") });
  if (!data) throw new ApiError(404, "Document introuvable");

  await logCaseActivity(auth, caseId, {
    action: "document.renamed",
    targetType: "document",
    targetId: docId,
  });
}

export async function deleteDocument(auth: AuthorizedCase, caseId: string, docId: string) {
  const doc = await findDocument<{ storage_path: string }>(auth, caseId, docId, "storage_path");

  // La ligne d'abord : si le document est verrouillé, la base refuse et le
  // fichier n'est pas touché.
  const { error } = await auth.admin
    .from("documents")
    .delete()
    .eq("id", docId)
    .eq("agency_id", auth.agencyId);
  if (error) throw dbError("documents delete", error, { "55006": LOCKED("supprimé") });

  const { error: removeError } = await auth.admin.storage
    .from(DOCUMENTS_BUCKET)
    .remove([doc.storage_path]);
  if (removeError) {
    // La ligne est supprimée : le fichier restant est orphelin et inaccessible
    console.error("[documents delete] fichier", removeError.name);
  }

  await logCaseActivity(auth, caseId, {
    action: "document.deleted",
    targetType: "document",
    targetId: docId,
  });
}

// Vers un dossier de rangement, ou vers « Sans dossier » (folderId null)
export async function moveDocument(
  auth: AuthorizedCase,
  caseId: string,
  docId: string,
  folderId: string | null,
) {
  const doc = await findDocument<{ folder_id: string | null }>(auth, caseId, docId, "folder_id");
  if (doc.folder_id === folderId) return;

  // La clé composite refuse un dossier qui n'est pas de ce candidat (23503)
  const { error } = await auth.admin
    .from("documents")
    .update({ folder_id: folderId })
    .eq("id", docId)
    .eq("agency_id", auth.agencyId);
  if (error) {
    throw dbError("documents move", error, {
      "55006": LOCKED("déplacé"),
      "23503": "Dossier introuvable",
    });
  }

  await logCaseActivity(auth, caseId, {
    action: "document.moved",
    targetType: "document",
    targetId: docId,
    details: { from_folder_id: doc.folder_id ?? null, to_folder_id: folderId },
  });
}

// Patron seulement ; la fonction SQL set_document_lock revérifie le rôle
export async function setDocumentLock(
  auth: AuthorizedCase,
  caseId: string,
  docId: string,
  locked: boolean,
) {
  if (!auth.member.isOwner) {
    throw new ApiError(403, "Seul le patron peut verrouiller un document");
  }
  await findDocument(auth, caseId, docId, "id");

  const { error } = await auth.admin.rpc("set_document_lock", {
    p_document_id: docId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_locked: locked,
  });
  if (error) throw dbError("documents lock", error, { P0002: "Document introuvable" });

  await logCaseActivity(auth, caseId, {
    action: locked ? "document.locked" : "document.unlocked",
    targetType: "document",
    targetId: docId,
  });
}
