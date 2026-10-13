import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/audit/log-activity";
import { safely } from "@/lib/api-errors";

async function removeEmployee(params: Promise<{ id: string }>) {
  const caller = await requireOwner();
  if (!caller) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "Identifiant invalide" },
      { status: 400 },
    );
  }

  if (id === caller.user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // La cible doit appartenir à l'agence de l'appelant
  const { data: target } = await admin
    .from("profiles")
    .select("id, role, is_active, first_name, last_name")
    .eq("id", id)
    .eq("agency_id", caller.profile.agency_id)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });
  }
  if (target.role !== "employee") {
    return NextResponse.json(
      { error: "Seuls les comptes employés peuvent être supprimés" },
      { status: 400 },
    );
  }
  if (target.is_active) {
    return NextResponse.json(
      { error: "Désactivez d'abord ce compte avant de le supprimer" },
      { status: 400 },
    );
  }

  // Supprime le compte Auth ; le profil est supprimé en cascade.
  // Si le compte a de l'historique (phases suivantes), la base refuse.
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    return NextResponse.json(
      {
        error:
          "Suppression impossible : ce compte a peut-être un historique. Gardez-le désactivé.",
      },
      { status: 409 },
    );
  }

  await logActivity(admin, {
    agencyId: caller.profile.agency_id,
    actorId: caller.user.id,
    action: "employee.deleted",
    targetType: "profile",
    targetId: id,
    details: { first_name: target.first_name, last_name: target.last_name },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safely("team delete", () => removeEmployee(params));
}
