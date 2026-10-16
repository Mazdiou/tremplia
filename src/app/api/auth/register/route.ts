import { ApiError, dbError, ok, parseBody, rateLimited, safely } from "@/lib/api-errors";
import { clientIp } from "@/lib/client-ip";
import { ipHash } from "@/features/student/server/keys";
import { logActivity } from "@/lib/audit/log-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { registerSchema } from "@/features/auth/schemas";

// Inscription d'une agence : compte du patron, agence et profil
export function POST(request: Request) {
  return safely("register", async () => {
    const d = await parseBody(request, registerSchema);
    const admin = createAdminClient();

    // 0. Essais limités : 3 par heure et par adresse, 30 en tout
    const { error: limitError } = await admin.rpc("register_attempt", {
      p_ip_hash: ipHash(clientIp(request)),
    });
    if (limitError) {
      throw (
        rateLimited(limitError, "Trop d'inscriptions pour le moment. Réessayez dans une heure.") ??
        dbError("register limit", limitError)
      );
    }

    // 1. Création du compte Auth
    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: d.email,
      password: d.password,
      email_confirm: true,
    });
    if (authError || !created.user) {
      throw new ApiError(400, "Impossible de créer le compte (e-mail déjà utilisé)");
    }

    // 2. Création de l'agence et du profil patron
    const { data: agencyId, error: rpcError } = await admin.rpc("create_agency_with_owner", {
      p_user_id: created.user.id,
      p_agency_name: d.agencyName,
      p_city: d.city,
      p_phone: d.phone,
      p_first_name: d.firstName,
      p_last_name: d.lastName,
    });

    // 3. En cas d'échec, le compte Auth créé est supprimé
    if (rpcError || typeof agencyId !== "string") {
      await admin.auth.admin.deleteUser(created.user.id);
      if (rpcError) console.error("[register]", rpcError.code);
      throw new ApiError(500, "Erreur lors de la création de l'agence");
    }

    await logActivity(admin, {
      agencyId,
      actorId: created.user.id,
      action: "agency.created",
      targetType: "agency",
      targetId: agencyId,
    });
    return ok({ ok: true }, 201);
  });
}
