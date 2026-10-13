import { z } from "zod";
import { ApiError, dbError, ok, parseBody, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { MAX_FOLDERS_PER_CASE, folderNameSchema } from "@/features/documents/schemas";

// Créer un dossier de rangement pour les documents (tout membre actif).
export function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("document folders create", async () => {
    const { id } = await params;
    const auth = await authorizeCase(id);
    const { name } = await parseBody(request, z.object({ name: folderNameSchema }));

    const { count, error: countError } = await auth.admin
      .from("document_folders")
      .select("id", { count: "exact", head: true })
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId);
    if (countError) throw dbError("document folders count", countError);
    if ((count ?? 0) >= MAX_FOLDERS_PER_CASE) {
      throw new ApiError(
        409,
        `Vous avez atteint la limite de ${MAX_FOLDERS_PER_CASE} dossiers pour ce candidat`,
      );
    }

    const { data, error } = await auth.admin
      .from("document_folders")
      .insert({
        agency_id: auth.agencyId,
        case_id: id,
        name,
        created_by: auth.member.userId,
      })
      .select("id")
      .single();
    if (error || !data) {
      throw error
        ? dbError("document folders create", error, { "23505": "Un dossier porte déjà ce nom" })
        : new ApiError(500, "Impossible de créer le dossier");
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.member.userId,
      action: "document_folder.created",
      targetType: "document_folder",
      targetId: data.id as string,
      caseId: id,
    });
    return ok({ id: data.id }, 201);
  });
}
