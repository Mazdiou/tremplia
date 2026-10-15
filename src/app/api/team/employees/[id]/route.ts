import { ApiError, dbError, ok, parseId, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { requireApiOwner } from "@/lib/auth/require-member";
import { requireWritableAgency } from "@/features/subscription/server/subscription";
import { createAdminClient } from "@/lib/supabase/admin";

// Supprimer un employé désactivé : patron seulement. La base refuse
// d'elle-même un patron, un compte actif, ou un compte qui a un historique
// (dossiers, documents, notes…) : il reste alors désactivé.
export function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("team delete", async () => {
    const member = await requireApiOwner();
    // Sinon la base refuserait en silence et le message parlerait d'historique
    await requireWritableAgency(member.agencyId);
    const id = parseId((await params).id);
    if (id === member.userId) {
      throw new ApiError(400, "Vous ne pouvez pas supprimer votre propre compte");
    }

    const admin = createAdminClient();
    const { data: target, error: readError } = await admin
      .from("profiles")
      .select("role, is_active")
      .eq("id", id)
      .eq("agency_id", member.agencyId)
      .maybeSingle();
    if (readError) throw dbError("team delete read", readError);
    if (!target) throw new ApiError(404, "Employé introuvable");
    if (target.role !== "employee") {
      throw new ApiError(400, "Seuls les comptes employés peuvent être supprimés");
    }
    if (target.is_active) {
      throw new ApiError(400, "Désactivez d'abord ce compte avant de le supprimer");
    }

    // Supprime le compte Auth ; le profil part en cascade
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      throw new ApiError(
        409,
        "Suppression impossible : ce compte a un historique. Gardez-le désactivé.",
      );
    }

    await logActivity(admin, {
      agencyId: member.agencyId,
      actorId: member.userId,
      action: "employee.deleted",
      targetType: "profile",
      targetId: id,
    });
    return ok();
  });
}
