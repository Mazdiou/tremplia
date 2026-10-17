import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { ApiError, dbError } from "@/lib/api-errors";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import { archiveEntries, archiveFileName } from "../archive";
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

type DocumentsStorage = ReturnType<AuthorizedCase["admin"]["storage"]["from"]>;

// Début d'un fichier reçu et sa taille, sans le télécharger en entier : lien
// signé lu avec un en-tête Range (5 premiers octets ; la taille totale est
// dans Content-Range). null si le fichier n'existe pas.
async function readFileHead(storage: DocumentsStorage, path: string) {
  const { data, error } = await storage.createSignedUrl(path, 60);
  if (error || !data) return null;
  const res = await fetch(data.signedUrl, {
    headers: { Range: "bytes=0-4" },
    cache: "no-store",
  });
  // Fichier vide : aucun octet à renvoyer
  if (res.status === 416) return { head: new Uint8Array(), size: 0 };
  if (!res.ok) return null;
  const body = new Uint8Array(await res.arrayBuffer());
  const total = res.headers.get("content-range")?.match(/\/(\d+)$/)?.[1];
  // Sans Content-Range (Range ignoré), la réponse est le fichier entier
  return { head: body.slice(0, 5), size: total ? Number(total) : body.length };
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

  const file = await readFileHead(storage, path);
  if (!file) {
    throw new ApiError(400, "Le fichier n'a pas été reçu. Réessayez l'envoi.");
  }

  const isPdf = new TextDecoder().decode(file.head) === "%PDF-";
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES || !isPdf) {
    await storage.remove([path]);
    throw new ApiError(
      400,
      file.size > MAX_DOCUMENT_BYTES ? "Le fichier dépasse 10 Mo" : "Ce fichier n'est pas un PDF valide",
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
    size_bytes: file.size,
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
    details: { size_bytes: file.size, folder_id: folderId },
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

// Archive ZIP de tous les documents du dossier : liens signés valables cinq
// minutes et chemin de chaque fichier dans l'archive. Le navigateur télécharge
// les fichiers et construit l'archive lui-même (une réponse du serveur ne peut
// pas dépasser quelques Mo sur Vercel). Inscrit au journal : c'est une copie
// de toutes les pièces du candidat.
export async function prepareArchive(auth: AuthorizedCase, caseId: string) {
  const [docsRes, foldersRes, caseRes] = await Promise.all([
    auth.admin
      .from("documents")
      .select("id, name, folder_id, storage_path")
      .eq("case_id", caseId)
      .eq("agency_id", auth.agencyId)
      .order("created_at"),
    auth.admin
      .from("document_folders")
      .select("id, name")
      .eq("case_id", caseId)
      .eq("agency_id", auth.agencyId),
    auth.admin
      .from("cases")
      .select("first_name, last_name")
      .eq("id", caseId)
      .eq("agency_id", auth.agencyId)
      .single(),
  ]);
  if (docsRes.error) throw dbError("documents archive", docsRes.error);
  if (foldersRes.error) throw dbError("documents archive folders", foldersRes.error);
  if (caseRes.error) throw dbError("documents archive case", caseRes.error);

  const docs = docsRes.data as { id: string; name: string; folder_id: string | null; storage_path: string }[];
  if (docs.length === 0) throw new ApiError(404, "Aucun document dans ce dossier");

  const { data: signed, error } = await auth.admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrls(
      docs.map((d) => d.storage_path),
      300,
    );
  if (error || !signed) {
    console.error("[documents archive]", error?.name ?? "erreur");
    throw new ApiError(500, "Impossible de préparer l'archive");
  }
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const paths = new Map(archiveEntries(docs, foldersRes.data ?? []).map((e) => [e.id, e.path]));

  const files = docs.flatMap((d) => {
    const url = urlByPath.get(d.storage_path);
    return url ? [{ path: paths.get(d.id) as string, url }] : [];
  });
  if (files.length < docs.length) {
    console.error("[documents archive] liens manquants", docs.length - files.length);
  }

  await logCaseActivity(auth, caseId, {
    action: "document.archive_downloaded",
    targetType: "case",
    targetId: caseId,
    details: { documents: files.length },
  });

  return {
    fileName: archiveFileName(caseRes.data.first_name as string, caseRes.data.last_name as string),
    files,
  };
}
