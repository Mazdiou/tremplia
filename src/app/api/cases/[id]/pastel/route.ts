import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret } from "@/lib/crypto/secrets";
import { logActivity } from "@/lib/audit/log-activity";

const emptyToUndefined = (v: unknown) =>
  typeof v === "string" && v.trim() === "" ? undefined : v;

const schema = z.object({
  pastelEmail: z.string().trim().toLowerCase().email().max(254),
  // Absent = l'ancien mot de passe est conservé (compte déjà existant)
  pastelPassword: z.preprocess(
    emptyToUndefined,
    z.string().min(1).max(200).optional(),
  ),
});

function fieldError(path: string, message: string) {
  return NextResponse.json(
    { error: "Données invalides", fields: [{ path, message }] },
    { status: 400 },
  );
}

async function setPastel(request: Request, id: string) {
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
    return NextResponse.json(
      {
        error: "Données invalides",
        fields: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message:
            i.path[0] === "pastelEmail" ? "E-mail Pastel invalide" : i.message,
        })),
      },
      { status: 400 },
    );
  }
  const { pastelEmail, pastelPassword } = parsed.data;

  const agencyId = caller.profile.agency_id as string;
  const admin = createAdminClient();

  // Le filtre sur agency_id est indispensable : la clé secrète contourne le RLS
  const { data: current, error: readError } = await admin
    .from("cases")
    .select("pastel_account, pastel_email")
    .eq("id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (readError) {
    console.error("[pastel PUT] lecture", readError.message);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
  }

  if (current.pastel_account === "to_create" && !pastelPassword) {
    return fieldError("pastelPassword", "Mot de passe Pastel requis");
  }

  // Le mot de passe est chiffré ici, lié à ce dossier précis
  const enc = pastelPassword
    ? encryptSecret(pastelPassword, `${agencyId}:${id}`)
    : null;

  const { error } = await admin.rpc("set_pastel_credentials", {
    p_case_id: id,
    p_agency_id: agencyId,
    p_actor_id: caller.user.id,
    p_pastel_email: pastelEmail,
    p_password_encrypted: enc?.value ?? null,
    p_key_version: enc?.keyVersion ?? 1,
  });

  if (error) {
    console.error(
      "[pastel PUT] set_pastel_credentials",
      error.code,
      error.message,
    );
    if (error.code === "23514") {
      return NextResponse.json(
        { error: "Données invalides : e-mail ou mot de passe Pastel manquant" },
        { status: 400 },
      );
    }
    if (error.code === "P0002") {
      return NextResponse.json(
        { error: "Dossier introuvable" },
        { status: 404 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement du compte Pastel" },
      { status: 500 },
    );
  }

  // Jamais de valeur dans le journal : seulement ce qui a changé
  await logActivity(admin, {
    agencyId,
    actorId: caller.user.id,
    action: "pastel.credentials_updated",
    targetType: "case",
    targetId: id,
    caseId: id,
    details: {
      account_created: current.pastel_account === "to_create",
      email_changed: current.pastel_email !== pastelEmail,
      password_changed: Boolean(pastelPassword),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await setPastel(request, id);
  } catch (e) {
    console.error("[pastel PUT]", e instanceof Error ? e.name : "erreur");
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
