import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret } from "@/lib/crypto/secrets";
import { logActivity } from "@/lib/audit/log-activity";

// Réponses toujours sans cache : le mot de passe ne doit rester nulle part.
const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

async function reveal(id: string) {
  // Tout employé actif de l'agence peut afficher (chaque consultation est journalisée)
  const caller = await requireMember();
  if (!caller) return fail("Accès refusé", 403);

  if (!z.string().uuid().safeParse(id).success) {
    return fail("Identifiant invalide", 400);
  }

  const agencyId = caller.profile.agency_id as string;
  const admin = createAdminClient();

  // Le filtre sur agency_id est indispensable : la clé secrète contourne le RLS
  const { data: row, error: readError } = await admin
    .from("case_pastel_credentials")
    .select("password_encrypted")
    .eq("case_id", id)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (readError) {
    console.error("[pastel reveal] lecture", readError.message);
    return fail("Erreur serveur", 500);
  }
  if (!row) return fail("Aucun mot de passe enregistré pour ce dossier", 404);

  // Journal D'ABORD : si la trace ne peut pas être écrite, rien n'est déchiffré
  // ni renvoyé. (logActivity ne lève pas d'erreur : elle renvoie false.)
  const logged = await logActivity(admin, {
    agencyId,
    actorId: caller.user.id,
    action: "pastel.password_viewed",
    targetType: "case",
    targetId: id,
    caseId: id,
  });
  if (!logged) return fail("Journal indisponible, réessayez dans un instant", 503);

  let password: string;
  try {
    password = decryptSecret(row.password_encrypted, `${agencyId}:${id}`);
  } catch (e) {
    // Jamais de valeur dans les logs, seulement la nature de l'erreur
    console.error(
      "[pastel reveal] déchiffrement",
      e instanceof Error ? e.name : "erreur",
    );
    return fail("Impossible de lire le mot de passe", 500);
  }

  return NextResponse.json({ password }, { headers: NO_STORE });
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return await reveal(id);
  } catch (e) {
    console.error("[pastel reveal]", e instanceof Error ? e.name : "erreur");
    return fail("Erreur serveur", 500);
  }
}
