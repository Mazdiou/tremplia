import { z } from "zod";
import { ApiError, dbError, ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { folderNameSchema } from "@/features/documents/schemas";

type Ctx = { params: Promise<{ id: string; folderId: string }> };

// Le dossier de documents doit appartenir à ce dossier candidat
async function findFolder(
  auth: Awaited<ReturnType<typeof authorizeCase>>,
  caseId: string,
  folderId: string,
) {
  const { data, error } = await auth.admin
    .from("document_folders")
    .select("name")
    .eq("id", folderId)
    .eq("case_id", caseId)
    .eq("agency_id", auth.agencyId)
    .maybeSingle();
  if (error) throw dbError("document folders read", error);
  if (!data) throw new ApiError(404, "Dossier introuvable");
  return data.name as string;
}

// Renommer un dossier de documents (tout membre actif)
export function PATCH(request: Request, { params }: Ctx) {
  return safely("document folders rename", async () => {
    const { id, folderId } = await params;
    const auth = await authorizeCase(id);
    parseId(folderId);
    const { name } = await parseBody(request, z.object({ name: folderNameSchema }));

    if ((await findFolder(auth, id, folderId)) === name) return ok();

    const { error } = await auth.admin
      .from("document_folders")
      .update({ name })
      .eq("id", folderId)
      .eq("agency_id", auth.agencyId);
    if (error) {
      throw dbError("document folders rename", error, { "23505": "Un dossier porte déjà ce nom" });
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "document_folder.renamed",
      targetType: "document_folder",
      targetId: folderId,
      caseId: id,
    });
    return ok();
  });
}

// Supprimer un dossier de documents : patron seulement. Les documents qu'il
// contient passent dans « Sans dossier » (aucun PDF n'est supprimé). La
// fonction SQL revérifie le rôle et refuse si un document est verrouillé.
export function DELETE(_request: Request, { params }: Ctx) {
  return safely("document folders delete", async () => {
    const { id, folderId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.member.isOwner) {
      throw new ApiError(403, "Seul le patron peut supprimer un dossier");
    }
    parseId(folderId);
    await findFolder(auth, id, folderId);

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
        P0002: "Dossier introuvable",
        "55006":
          "Ce dossier contient un document verrouillé par le patron : déverrouillez-le d'abord",
      });
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "document_folder.deleted",
      targetType: "document_folder",
      targetId: folderId,
      caseId: id,
      details: { documents_moved: count ?? 0 },
    });
    return ok();
  });
}
