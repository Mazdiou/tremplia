import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { requireOwner } from "@/lib/auth/require-owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/audit/log-activity";
import { safely } from "@/lib/api-errors";

const schema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
});

// Sans caractères ambigus (0/O, 1/l/I) pour faciliter la communication
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateTemporaryPassword(length = 12) {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

async function createEmployee(request: Request) {
  const caller = await requireOwner();
  if (!caller) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
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
  const d = parsed.data;

  const admin = createAdminClient();
  const temporaryPassword = generateTemporaryPassword();

  const { data: created, error: authError } = await admin.auth.admin.createUser(
    {
      email: d.email,
      password: temporaryPassword,
      email_confirm: true,
    },
  );
  if (authError || !created.user) {
    return NextResponse.json(
      { error: "Impossible de créer le compte (e-mail déjà utilisé ?)" },
      { status: 400 },
    );
  }

  // L'agence vient du profil du patron connecté, jamais du navigateur
  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    agency_id: caller.profile.agency_id,
    first_name: d.firstName,
    last_name: d.lastName,
    role: "employee",
    must_change_password: true,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'employé" },
      { status: 500 },
    );
  }

  await logActivity(admin, {
    agencyId: caller.profile.agency_id,
    actorId: caller.user.id,
    action: "employee.created",
    targetType: "profile",
    targetId: created.user.id,
    details: { first_name: d.firstName, last_name: d.lastName },
  });

  // Le mot de passe temporaire n'est renvoyé qu'une seule fois, au patron
  return NextResponse.json({ ok: true, temporaryPassword }, { status: 201 });
}

export async function POST(request: Request) {
  return safely("team create", () => createEmployee(request));
}
