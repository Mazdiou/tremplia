import { z } from "zod";
import { ApiError, dbError, ok, parseBody, parseId, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { requireApiOwner } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ isActive: z.boolean() });

// Désactiver / réactiver un employé : patron seulement, jamais lui-même
// (règles revérifiées par set_employee_active).
export function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return safely("team status", async () => {
    const member = await requireApiOwner();
    const id = parseId((await params).id);
    const { isActive } = await parseBody(request, schema);
    if (id === member.userId) {
      throw new ApiError(400, "Vous ne pouvez pas modifier votre propre statut");
    }

    const admin = createAdminClient();
    const { data: target, error: readError } = await admin
      .from("profiles")
      .select("is_active, role")
      .eq("id", id)
      .eq("agency_id", member.agencyId)
      .maybeSingle();
    if (readError) throw dbError("team status read", readError);
    if (!target) throw new ApiError(404, "Employé introuvable");
    if (target.role !== "employee") {
      throw new ApiError(400, "Seul un compte employé peut être désactivé");
    }
    if (target.is_active === isActive) return ok();

    // 1. Bloquer ou débloquer le compte côté Auth
    const { error: banError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: isActive ? "none" : "876000h",
    });
    if (banError) throw new ApiError(500, "Opération impossible");

    // 2. Mettre à jour le profil (annule le blocage Auth si ça échoue)
    const { error } = await admin.rpc("set_employee_active", {
      p_agency_id: member.agencyId,
      p_actor_id: member.userId,
      p_employee_id: id,
      p_active: isActive,
    });
    if (error) {
      await admin.auth.admin.updateUserById(id, {
        ban_duration: isActive ? "876000h" : "none",
      });
      throw dbError("team status", error, { P0002: "Employé introuvable" });
    }

    await logActivity(admin, {
      agencyId: member.agencyId,
      actorId: member.userId,
      action: isActive ? "employee.reactivated" : "employee.deactivated",
      targetType: "profile",
      targetId: id,
    });
    return ok();
  });
}
