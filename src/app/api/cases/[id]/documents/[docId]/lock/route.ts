import { z } from "zod";
import { authorizeCase } from "@/features/cases/server/authorize-case";
import { fail, ok, readJson, validationError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";

// Verrouiller / déverrouiller : patron seulement. La fonction SQL
// set_document_lock revérifie le rôle côté base.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  try {
    const { id, docId } = await params;
    const auth = await authorizeCase(id);
    if (!auth.ok) return auth.response;

    if (auth.caller.profile.role !== "owner") {
      return fail("Seul le patron peut verrouiller un document", 403);
    }
    if (!z.string().uuid().safeParse(docId).success) {
      return fail("Identifiant invalide", 400);
    }

    const body = await readJson(request);
    if (body === null) return fail("Requête invalide", 400);
    const parsed = z.object({ locked: z.boolean() }).safeParse(body);
    if (!parsed.success) return validationError(parsed.error);
    const { locked } = parsed.data;

    const { data: doc } = await auth.admin
      .from("documents")
      .select("id")
      .eq("id", docId)
      .eq("case_id", id)
      .eq("agency_id", auth.agencyId)
      .maybeSingle();
    if (!doc) return fail("Document introuvable", 404);

    const { error } = await auth.admin.rpc("set_document_lock", {
      p_document_id: docId,
      p_agency_id: auth.agencyId,
      p_actor_id: auth.caller.user.id,
      p_locked: locked,
    });
    if (error) {
      if (error.code === "42501") return fail("Accès refusé", 403);
      if (error.code === "P0002") return fail("Document introuvable", 404);
      console.error("[documents lock]", error.message);
      return fail("Impossible de changer le verrou", 500);
    }

    await logActivity(auth.admin, {
      agencyId: auth.agencyId,
      actorId: auth.caller.user.id,
      action: locked ? "document.locked" : "document.unlocked",
      targetType: "document",
      targetId: docId,
      caseId: id,
    });

    return ok();
  } catch (e) {
    console.error("[documents lock]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
