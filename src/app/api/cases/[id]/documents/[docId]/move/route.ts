import { z } from "zod";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { fail, ok, readJson, validationError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";

// Déplacer un document vers un dossier (folderId) ou vers « Sans dossier »
// (folderId = null). Tout membre actif ; un document verrouillé ne bouge pas
// (le trigger de la base refuse, code 55006).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;
    if (!z.string().uuid().safeParse(docId).success) {
      return fail("Identifiant invalide", 400);
    }

    const body = await readJson(request);
    if (body === null) return fail("Requête invalide", 400);
    const parsed = z
      .object({ folderId: z.string().uuid().nullable() })
      .safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { folderId } = parsed.data;

    const { data: doc, error: readError } = await auth.admin
      .from("documents")
      .select("id, name, folder_id")
      .eq("id", docId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (readError) {
      console.error("[documents move] lecture", readError.message);
      return fail("Erreur serveur", 500);
    }
    if (!doc) return fail("Document introuvable", 404);
    if (doc.folder_id === folderId) return ok();

    // Noms des dossiers de départ et d'arrivée, pour le journal
    const ids = [doc.folder_id, folderId].filter(
      (v): v is string => v !== null,
    );
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const { data: folders, error: foldersError } = await auth.admin
        .from("document_folders")
        .select("id, name")
        .in("id", ids)
        .eq("case_id", id)
        .eq("agency_id", auth.agencyId);
      if (foldersError) {
        console.error("[documents move] dossiers", foldersError.message);
        return fail("Erreur serveur", 500);
      }
      for (const f of folders ?? []) names.set(f.id, f.name);
    }
    if (folderId !== null && !names.has(folderId)) {
      return fail("Dossier introuvable", 404);
    }

    const { error } = await auth.admin
      .from("documents")
      .update({ folder_id: folderId })
      .eq("id", docId)
      .eq("agency_id", auth.agencyId);
    if (error) {
      if (error.code === "55006") {
        return fail(
          "Ce document est verrouillé par le patron : il ne peut plus être déplacé",
          409,
        );
      }
      // 23503 : le dossier d'arrivée n'appartient pas à ce candidat
      if (error.code === "23503") return fail("Dossier introuvable", 404);
      console.error("[documents move]", error.message);
      return fail("Impossible de déplacer le document", 500);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "document.moved",
      targetType: "document",
      targetId: docId,
      caseId: id,
      details: {
        name: doc.name,
        from_folder: doc.folder_id ? (names.get(doc.folder_id) ?? null) : null,
        to_folder: folderId ? (names.get(folderId) ?? null) : null,
      },
    });

    return ok();
  } catch (e) {
    console.error("[documents move]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
