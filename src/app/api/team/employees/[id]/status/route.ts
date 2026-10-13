import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/audit/log-activity";
import { safely } from "@/lib/api-errors";

const schema = z.object({ isActive: z.boolean() });

async function setActive(request: Request, params: Promise<{ id: string }>) {
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }
  const { isActive } = parsed.data;

  // Un patron ne peut pas se désactiver lui-même : l'agence garde
  // donc toujours au moins un patron actif (l'appelant).
  if (id === caller.user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas modifier votre propre statut" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // La cible doit appartenir à l'agence de l'appelant
  const { data: target } = await admin
    .from("profiles")
    .select("id, is_active, first_name, last_name")
    .eq("id", id)
    .eq("agency_id", caller.profile.agency_id)
    .single();

  if (!target) {
    return NextResponse.json({ error: "Employé introuvable" }, { status: 404 });
  }
  if (target.is_active === isActive) {
    return NextResponse.json({ ok: true });
  }

  // 1. Bloquer ou débloquer le compte côté Auth
  const { error: banError } = await admin.auth.admin.updateUserById(id, {
    ban_duration: isActive ? "none" : "876000h",
  });
  if (banError) {
    return NextResponse.json(
      { error: "Opération impossible" },
      { status: 500 },
    );
  }

  // 2. Mettre à jour le profil (annule le blocage Auth si ça échoue)
  const { error: updateError } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("agency_id", caller.profile.agency_id);

  if (updateError) {
    await admin.auth.admin.updateUserById(id, {
      ban_duration: isActive ? "876000h" : "none",
    });
    return NextResponse.json(
      { error: "Opération impossible" },
      { status: 500 },
    );
  }

  await logActivity(admin, {
    agencyId: caller.profile.agency_id,
    actorId: caller.user.id,
    action: isActive ? "employee.reactivated" : "employee.deactivated",
    targetType: "profile",
    targetId: id,
    details: { first_name: target.first_name, last_name: target.last_name },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return safely("team status", () => setActive(request, params));
}
