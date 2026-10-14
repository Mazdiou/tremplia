import { randomInt } from "node:crypto";
import { ApiError, ok, parseBody, safely } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import { requireApiOwner } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { newEmployeeSchema } from "@/features/auth/schemas";

// Sans caractères ambigus (0/O, 1/l/I) pour faciliter la communication
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTemporaryPassword(length = 12) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

// Ajouter un employé : patron seulement (revérifié par add_employee)
export function POST(request: Request) {
  return safely("team create", async () => {
    const member = await requireApiOwner();
    const d = await parseBody(request, newEmployeeSchema);

    const admin = createAdminClient();
    const temporaryPassword = generateTemporaryPassword();
    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email: d.email,
      password: temporaryPassword,
      email_confirm: true,
    });
    if (authError || !created.user) {
      throw new ApiError(400, "Impossible de créer le compte (e-mail déjà utilisé ?)");
    }

    const { error } = await admin.rpc("add_employee", {
      p_agency_id: member.agencyId,
      p_actor_id: member.userId,
      p_user_id: created.user.id,
      p_first_name: d.firstName,
      p_last_name: d.lastName,
    });
    if (error) {
      await admin.auth.admin.deleteUser(created.user.id);
      console.error("[team create]", error.code);
      throw new ApiError(500, "Erreur lors de la création de l'employé");
    }

    await logActivity(admin, {
      agencyId: member.agencyId,
      actorId: member.userId,
      action: "employee.created",
      targetType: "profile",
      targetId: created.user.id,
    });

    // Le mot de passe temporaire n'est renvoyé qu'une seule fois, au patron
    return ok({ ok: true, temporaryPassword }, 201);
  });
}
