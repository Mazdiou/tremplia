import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/audit/log-activity";
import { CASE_STATUSES } from "@/features/cases/labels";

const schema = z.object({ status: z.enum(CASE_STATUSES) });

const ACTIONS = {
  active: "case.reopened",
  closed: "case.closed",
  abandoned: "case.abandoned",
} as const;

async function changeStatus(request: Request, id: string) {
  const caller = await requireMember();
  if (!caller) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

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
  const { status } = parsed.data;

  // L'agence vient de la session. La clé secrète contourne le RLS :
  // le filtre sur agency_id est donc indispensable.
  const agencyId = caller.profile.agency_id as string;
  const admin = createAdminClient();

  const { data: current, error: readError } = await admin
    .from("cases")
    .select("id, status")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (readError) {
    console.error("[cases status] lecture", readError.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }
  if (current.status === status) {
    return NextResponse.json({ ok: true });
  }

  const { error: updateError } = await admin
    .from("cases")
    .update({
      status,
      archived_at: status === "active" ? null : new Date().toISOString(),
    })
    .eq("id", id)
    .eq("agency_id", agencyId);

  if (updateError) {
    console.error("[cases status] mise à jour", updateError.message);
    return NextResponse.json(
      { error: "Impossible de changer le statut" },
      { status: 500 },
    );
  }

  await logActivity(admin, {
    agencyId,
    actorId: caller.user.id,
    action: ACTIONS[status],
    targetType: "case",
    targetId: id,
    caseId: id,
    details: { from: current.status, to: status },
  });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await changeStatus(request, id);
  } catch (e) {
    console.error("[cases status]", e instanceof Error ? e.name : "erreur");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
