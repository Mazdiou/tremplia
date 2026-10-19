import "server-only";
import { randomInt } from "node:crypto";
import { ApiError, dbError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireWritableAgency } from "@/features/subscription/server/subscription";
import type { NewEmployeeInput } from "../schemas";
import { reportError } from "@/lib/report-error";

// Comptes des employés : patron seulement (l'appelant est vérifié par la
// route, les règles revérifiées par les fonctions SQL). Le compte de
// connexion (Supabase Auth) et le profil sont tenus ensemble.

// Sans caractères ambigus (0/O, 1/l/I) pour faciliter la communication
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function temporaryPassword(length = 12) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

// Renvoie le mot de passe temporaire, montré une seule fois au patron
export async function addEmployee(owner: Member, input: NewEmployeeInput) {
  // Avant de créer le compte de connexion, qui serait ensuite à supprimer
  await requireWritableAgency(owner.agencyId);

  const admin = createAdminClient();
  const password = temporaryPassword();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email: input.email,
    password,
    email_confirm: true,
  });
  if (authError || !created.user) {
    throw new ApiError(400, "Impossible de créer le compte (e-mail déjà utilisé ?)");
  }

  const { error } = await admin.rpc("add_employee", {
    p_agency_id: owner.agencyId,
    p_actor_id: owner.userId,
    p_user_id: created.user.id,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
  });
  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    reportError("[team create]", error.code);
    throw new ApiError(500, "Erreur lors de la création de l'employé");
  }

  await logActivity(admin, {
    agencyId: owner.agencyId,
    actorId: owner.userId,
    action: "employee.created",
    targetType: "profile",
    targetId: created.user.id,
  });
  return password;
}

// L'employé doit être un employé de l'agence du patron
async function findEmployee(owner: Member, employeeId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", employeeId)
    .eq("agency_id", owner.agencyId)
    .maybeSingle();
  if (error) throw dbError("team read", error);
  if (!data) throw new ApiError(404, "Employé introuvable");
  return { admin, role: data.role as string, isActive: data.is_active as boolean };
}

// Désactiver / réactiver un employé, jamais soi-même (règles revérifiées par
// set_employee_active)
export async function setEmployeeActive(owner: Member, employeeId: string, isActive: boolean) {
  if (employeeId === owner.userId) {
    throw new ApiError(400, "Vous ne pouvez pas modifier votre propre statut");
  }
  const target = await findEmployee(owner, employeeId);
  if (target.role !== "employee") {
    throw new ApiError(400, "Seul un compte employé peut être désactivé");
  }
  if (target.isActive === isActive) return;
  const { admin } = target;

  // 1. Bloquer ou débloquer le compte côté Auth
  const { error: banError } = await admin.auth.admin.updateUserById(employeeId, {
    ban_duration: isActive ? "none" : "876000h",
  });
  if (banError) throw new ApiError(500, "Opération impossible");

  // 2. Mettre à jour le profil (annule le blocage Auth si ça échoue)
  const { error } = await admin.rpc("set_employee_active", {
    p_agency_id: owner.agencyId,
    p_actor_id: owner.userId,
    p_employee_id: employeeId,
    p_active: isActive,
  });
  if (error) {
    await admin.auth.admin.updateUserById(employeeId, {
      ban_duration: isActive ? "876000h" : "none",
    });
    throw dbError("team status", error, { P0002: "Employé introuvable" });
  }

  await logActivity(admin, {
    agencyId: owner.agencyId,
    actorId: owner.userId,
    action: isActive ? "employee.reactivated" : "employee.deactivated",
    targetType: "profile",
    targetId: employeeId,
  });
}

// Supprimer un employé désactivé. La base refuse d'elle-même un patron, un
// compte actif, ou un compte qui a un historique (dossiers, documents,
// notes…) : il reste alors désactivé.
export async function deleteEmployee(owner: Member, employeeId: string) {
  // Sinon la base refuserait en silence et le message parlerait d'historique
  await requireWritableAgency(owner.agencyId);
  if (employeeId === owner.userId) {
    throw new ApiError(400, "Vous ne pouvez pas supprimer votre propre compte");
  }
  const target = await findEmployee(owner, employeeId);
  if (target.role !== "employee") {
    throw new ApiError(400, "Seuls les comptes employés peuvent être supprimés");
  }
  if (target.isActive) {
    throw new ApiError(400, "Désactivez d'abord ce compte avant de le supprimer");
  }

  // Supprime le compte Auth ; le profil part en cascade
  const { error } = await target.admin.auth.admin.deleteUser(employeeId);
  if (error) {
    throw new ApiError(409, "Suppression impossible : ce compte a un historique. Gardez-le désactivé.");
  }

  await logActivity(target.admin, {
    agencyId: owner.agencyId,
    actorId: owner.userId,
    action: "employee.deleted",
    targetType: "profile",
    targetId: employeeId,
  });
}
