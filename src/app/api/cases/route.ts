import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireMember } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto/secrets";
import { logActivity } from "@/lib/audit/log-activity";
import { createCaseSchema } from "@/features/cases/schemas";

async function createCase(request: Request) {
  const caller = await requireMember();
  if (!caller) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const parsed = createCaseSchema.safeParse(body);
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

  // L'agence et le créateur viennent de la session, jamais du navigateur
  const agencyId = caller.profile.agency_id as string;
  const caseId = randomUUID();
  const isExisting = d.pastelAccount === "existing";

  // Responsable : le patron choisit (lui-même par défaut), l'employé est
  // toujours responsable de ses propres dossiers, quoi que dise la requête.
  const isOwner = caller.profile.role === "owner";
  const assignedTo = isOwner
    ? (d.assignedTo ?? caller.user.id)
    : caller.user.id;

  // Le mot de passe est chiffré ici, lié à ce dossier précis.
  // Pour un compte "à créer", rien n'est enregistré.
  let passwordEncrypted: string | null = null;
  let keyVersion = 1;
  if (isExisting) {
    const enc = encryptSecret(d.pastelPassword!, `${agencyId}:${caseId}`);
    passwordEncrypted = enc.value;
    keyVersion = enc.keyVersion;
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("create_case", {
    p_case_id: caseId,
    p_agency_id: agencyId,
    p_created_by: caller.user.id,
    p_assigned_to: assignedTo,
    p_first_name: d.firstName,
    p_last_name: d.lastName,
    p_birth_date: d.birthDate,
    p_phone: d.phone,
    p_email: d.email ?? null,
    p_education_level: d.educationLevel,
    p_main_track: d.mainTrack ?? null,
    p_schools: d.schools,
    p_scope: d.scope,
    p_pastel_account: d.pastelAccount,
    p_pastel_email: isExisting ? (d.pastelEmail ?? null) : null,
    p_language_tests: [...new Set(d.languageTests)],
    p_diplomas: [...new Set(d.diplomas)],
    p_password_encrypted: passwordEncrypted,
    p_key_version: keyVersion,
  });

  if (error) {
    console.error("[cases POST] create_case", error.code, error.message);
    if (error.code === "22023") {
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
    if (error.code === "P0001") {
      return NextResponse.json(
        { error: "Aucune campagne en cours : contactez le support" },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la création du dossier" },
      { status: 500 },
    );
  }

  // Jamais de mot de passe dans le journal
  await logActivity(admin, {
    agencyId,
    actorId: caller.user.id,
    action: "case.created",
    targetType: "case",
    targetId: caseId,
    caseId,
    details: {
      first_name: d.firstName,
      last_name: d.lastName,
      assigned_to: assignedTo,
    },
  });

  return NextResponse.json({ ok: true, id: caseId }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    return await createCase(request);
  } catch (e) {
    console.error("[cases POST]", e instanceof Error ? e.name : "erreur");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
