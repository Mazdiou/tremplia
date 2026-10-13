import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/audit/log-activity";
import { updateCaseSchema } from "@/features/cases/schemas";
import { diffCase, type CaseEditable } from "@/features/cases/case-diff";

async function updateCase(request: Request, id: string) {
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

  const parsed = updateCaseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Données invalides",
        fields: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }
  const d = parsed.data;

  // L'agence vient de la session. La clé secrète contourne le RLS :
  // le filtre sur agency_id est indispensable.
  const agencyId = caller.profile.agency_id as string;
  const isOwner = caller.profile.role === "owner";
  const admin = createAdminClient();

  const { data: current, error: readError } = await admin
    .from("cases")
    .select(
      "first_name, last_name, birth_date, phone, email, education_level, main_track, schools, scope, language_tests, diplomas, assigned_to",
    )
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (readError) {
    console.error("[cases PATCH] lecture", readError.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }

  // Responsable : seul le patron peut le changer. Pour un employé,
  // assignedTo est ignoré, quoi que dise la requête.
  let nextAssigned: string | null = current.assigned_to;
  if (isOwner && d.assignedTo && d.assignedTo !== current.assigned_to) {
    const { data: member } = await admin
      .from("profiles")
      .select("id")
      .eq("id", d.assignedTo)
      .eq("agency_id", agencyId)
      .eq("is_active", true)
      .maybeSingle();
    if (!member) {
      return NextResponse.json(
        {
          error: "Données invalides",
          fields: [
            {
              path: "assignedTo",
              message:
                "Responsable invalide (compte inactif ou d'une autre agence)",
            },
          ],
        },
        { status: 400 },
      );
    }
    nextAssigned = d.assignedTo;
  }

  const next: CaseEditable = {
    first_name: d.firstName,
    last_name: d.lastName,
    birth_date: d.birthDate,
    phone: d.phone,
    email: d.email ?? null,
    education_level: d.educationLevel,
    main_track: d.mainTrack ?? null,
    schools: d.schools,
    scope: d.scope,
    language_tests: d.languageTests,
    diplomas: d.diplomas,
    assigned_to: nextAssigned,
  };

  const { patch, fields, changes } = diffCase(current as CaseEditable, next);
  if (fields.length === 0) {
    return NextResponse.json({ ok: true, changed: [] });
  }

  const { error: updateError } = await admin
    .from("cases")
    .update(patch)
    .eq("id", id)
    .eq("agency_id", agencyId);

  if (updateError) {
    console.error(
      "[cases PATCH] mise à jour",
      updateError.code,
      updateError.message,
    );
    if (updateError.code === "23514") {
      return NextResponse.json(
        {
          error: "Données invalides : une règle du dossier n'est pas respectée",
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la modification du dossier" },
      { status: 500 },
    );
  }

  // Journal : jamais la valeur du téléphone, de l'e-mail ni de la date de naissance
  await logActivity(admin, {
    agencyId,
    actorId: caller.user.id,
    action: "case.updated",
    targetType: "case",
    targetId: id,
    caseId: id,
    details: { fields, changes },
  });

  if (fields.includes("assigned_to")) {
    await logActivity(admin, {
      agencyId,
      actorId: caller.user.id,
      action: "case.assigned",
      targetType: "case",
      targetId: id,
      caseId: id,
      details: { from: current.assigned_to, to: nextAssigned },
    });
  }

  return NextResponse.json({ ok: true, changed: fields });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await updateCase(request, id);
  } catch (e) {
    console.error("[cases PATCH]", e instanceof Error ? e.name : "erreur");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
