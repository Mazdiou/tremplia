import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import { MAX_FOLDERS_PER_CASE } from "../schemas";

// Dossiers de rangement des documents d'un dossier candidat (un seul niveau).

const NAME_TAKEN = { "23505": "Une catégorie porte déjà ce nom" };

// Le dossier de documents doit appartenir à ce dossier candidat
async function findFolder(auth: AuthorizedCase, caseId: string, folderId: string) {
  const { data, error } = await auth.admin
    .from("document_folders")
    .select("name")
    .eq("id", folderId)
    .eq("case_id", caseId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (error) throw dbError("document folders read", error);
  if (!data) throw new ApiError(404, "Cette catégorie n'existe plus");
  return data.name as string;
}

// Tout membre actif
export async function createFolder(auth: AuthorizedCase, caseId: string, name: string) {
  const { count, error: countError } = await auth.admin
    .from("document_folders")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .eq("agency_id", auth.agencyId);
  if (countError) throw dbError("document folders count", countError);
  if ((count ?? 0) >= MAX_FOLDERS_PER_CASE) {
    throw new ApiError(
      409,
      `${MAX_FOLDERS_PER_CASE} catégories au maximum par candidat`,
    );
  }

  const { data, error } = await auth.admin
    .from("document_folders")
    .insert({
      agency_id: auth.agencyId,
      case_id: caseId,
      name,
      created_by: auth.member.userId,
    })
    .select("id")
    .single();
  if (error || !data) {
    throw error
      ? dbError("document folders create", error, NAME_TAKEN)
      : new ApiError(500, "La catégorie n'a pas pu être créée. Réessayez.");
  }

  const id = data.id as string;
  await logCaseActivity(auth, caseId, {
    action: "document_folder.created",
    targetType: "document_folder",
    targetId: id,
  });
  return id;
}

// Tout membre actif
export async function renameFolder(
  auth: AuthorizedCase,
  caseId: string,
  folderId: string,
  name: string,
) {
  if ((await findFolder(auth, caseId, folderId)) === name) return;

  const { error } = await auth.admin
    .from("document_folders")
    .update({ name })
    .eq("id", folderId)
    .eq("agency_id", auth.agencyId);
  if (error) throw dbError("document folders rename", error, NAME_TAKEN);

  await logCaseActivity(auth, caseId, {
    action: "document_folder.renamed",
    targetType: "document_folder",
    targetId: folderId,
  });
}

// Patron seulement. Les documents du dossier passent dans « Sans catégorie »
// (aucun PDF n'est supprimé). La fonction SQL revérifie le rôle et refuse
// si un document est verrouillé.
export async function deleteFolder(auth: AuthorizedCase, caseId: string, folderId: string) {
  if (!auth.member.isOwner) {
    throw new ApiError(403, "Seul le patron peut supprimer une catégorie");
  }
  await findFolder(auth, caseId, folderId);

  const { count, error: countError } = await auth.admin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("folder_id", folderId)
    .eq("agency_id", auth.agencyId);
  if (countError) throw dbError("document folders count", countError);

  const { error } = await auth.admin.rpc("delete_document_folder", {
    p_folder_id: folderId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
  });
  if (error) {
    throw dbError("document folders delete", error, {
      P0002: "Cette catégorie n'existe plus",
      "55006":
        "Cette catégorie contient un document verrouillé. Déverrouillez-le d'abord.",
    });
  }

  await logCaseActivity(auth, caseId, {
    action: "document_folder.deleted",
    targetType: "document_folder",
    targetId: folderId,
    details: { documents_moved: count ?? 0 },
  });
}
