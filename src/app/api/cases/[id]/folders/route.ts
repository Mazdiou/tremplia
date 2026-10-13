import { z } from "zod";
import { MAX_FOLDERS_PER_CASE, folderNameSchema } from "@/features/documents/schemas";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { fail, ok, readJson, validationError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";

// Créer un dossier de rangement pour les documents (tout membre actif).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;

    const body = await readJson(request);
    if (body === null) return fail("Requête invalide", 400);
    const parsed = z.object({ name: folderNameSchema }).safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { name } = parsed.data;

    const { count, error: countError } = await auth.admin
      .from("document_folders")
      .select("id", { count: "exact", head: true })
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId);
    if (countError) {
      console.error("[folders create] comptage", countError.message);
      return fail("Erreur serveur", 500);
    }
    if ((count ?? 0) >= MAX_FOLDERS_PER_CASE) {
      return fail(
        `Vous avez atteint la limite de ${MAX_FOLDERS_PER_CASE} dossiers pour ce candidat`,
        409,
      );
    }

    const { data, error } = await auth.admin
      .from("document_folders")
      .insert({
        agency_id: auth.agencyId,
        case_id: id,
        name,
        created_by: auth.caller.user.id,
      })
      .select("id")
      .single();

    if (error || !data) {
      // 23505 : un dossier porte déjà ce nom (majuscules ignorées)
      if (error?.code === "23505") {
        return fail("Un dossier porte déjà ce nom", 409);
      }
      console.error("[folders create]", error?.message);
      return fail("Impossible de créer le dossier", 500);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: "folder.created",
      targetType: "document_folder",
      targetId: data.id,
      caseId: id,
      details: { name },
    });

    return ok({ id: data.id }, 201);
  } catch (e) {
    console.error("[folders create]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
