import { z } from "zod";
import { folderNameSchema } from "@/lib/documents";
import {
  authorizeCase,
  fail,
  ok,
  readJson,
  validationError,
} from "@/lib/documents-api";
import { logActivity } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string; folderId: string }> };

// Renommer un dossier de documents (tout membre actif).
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const { id, folderId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;
    if (!z.string().uuid().safeParse(folderId).success) {
      return fail("Identifiant invalide", 400);
    }

    const body = await readJson(request);
    if (body === null) return fail("Requête invalide", 400);
    const parsed = z.object({ name: folderNameSchema }).safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { name } = parsed.data;

    const { data: folder, error: readError } = await auth.admin
      .from("document_folders")
      .select("id, name")
      .eq("id", folderId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (readError) {
      console.error("[folders rename] lecture", readError.message);
      return fail("Erreur serveur", 500);
    }
    if (!folder) return fail("Dossier introuvable", 404);
    if (folder.name === name) return ok();

    const { error } = await auth.admin
      .from("document_folders")
      .update({ name })
      .eq("id", folderId)
      .eq("agency_id", auth.agencyId);
    if (error) {
      if (error.code === "23505") {
        return fail("Un dossier porte déjà ce nom", 409);
      }
      console.error("[folders rename]", error.message);
      return fail("Impossible de renommer le dossier", 500);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "folder.renamed",
      targetType: "document_folder",
      targetId: folderId,
      caseId: id,
      details: { from: folder.name, to: name },
    });

    return ok();
  } catch (e) {
    console.error("[folders rename]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}

// Supprimer un dossier de documents : patron seulement. Les documents qu'il
// contient passent dans « Sans dossier » (aucun PDF n'est supprimé). La
// fonction SQL revérifie le rôle et refuse si un document est verrouillé.
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const { id, folderId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;

    if (auth.caller.profile.role !== "owner") {
      return fail("Seul le patron peut supprimer un dossier", 403);
    }
    if (!z.string().uuid().safeParse(folderId).success) {
      return fail("Identifiant invalide", 400);
    }

    const { data: folder, error: readError } = await auth.admin
      .from("document_folders")
      .select("id, name")
      .eq("id", folderId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (readError) {
      console.error("[folders delete] lecture", readError.message);
      return fail("Erreur serveur", 500);
    }
    if (!folder) return fail("Dossier introuvable", 404);

    const { count } = await auth.admin
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("folder_id", folderId)
      .eq("agency_id", auth.agencyId);

    const { error } = await auth.admin.rpc("delete_document_folder", {
      p_folder_id: folderId,
      p_agency_id: auth.agencyId,
      p_actor_id: auth.caller.user.id,
    });
    if (error) {
      if (error.code === "42501") return fail("Accès refusé", 403);
      if (error.code === "P0002") return fail("Dossier introuvable", 404);
      if (error.code === "55006") {
        return fail(
          "Ce dossier contient un document verrouillé par le patron : déverrouillez-le d'abord",
          409,
        );
      }
      console.error("[folders delete]", error.message);
      return fail("Impossible de supprimer le dossier", 500);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "folder.deleted",
      targetType: "document_folder",
      targetId: folderId,
      caseId: id,
      details: { name: folder.name, documents_moved: count ?? 0 },
    });

    return ok();
  } catch (e) {
    console.error("[folders delete]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
