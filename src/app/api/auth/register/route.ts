import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/lib/audit/log-activity";
import { safely } from "@/lib/api-errors";

const schema = z.object({
  agencyName: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  phone: z.string().trim().min(6).max(30),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
});

async function register(request: Request) {
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

  // 1. Création du compte Auth
  const { data: created, error: authError } = await admin.auth.admin.createUser(
    {
      email: d.email,
      password: d.password,
      email_confirm: true,
    },
  );

  if (authError || !created.user) {
    return NextResponse.json(
      { error: "Impossible de créer le compte (e-mail déjà utilisé)" },
      { status: 400 },
    );
  }

  // 2. Création de l'agence et du profil patron
  const { data: agencyId, error: rpcError } = await admin.rpc(
    "create_agency_with_owner",
    {
      p_user_id: created.user.id,
      p_agency_name: d.agencyName,
      p_city: d.city,
      p_phone: d.phone,
      p_first_name: d.firstName,
      p_last_name: d.lastName,
    },
  );

  // 3. Si échec : on supprime le compte Auth créé
  if (rpcError || !agencyId) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'agence" },
      { status: 500 },
    );
  }

  await logActivity(admin, {
    agencyId: agencyId as string,
    actorId: created.user.id,
    action: "agency.created",
    targetType: "agency",
    targetId: agencyId as string,
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function POST(request: Request) {
  return safely("register", () => register(request));
}
