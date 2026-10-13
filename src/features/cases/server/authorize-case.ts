import "server-only";
import { z } from "zod";
import { requireMember } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail } from "@/lib/api-errors";

// Vérifie l'appelant, l'identifiant et que le dossier est bien celui de son
// agence. La clé secrète contourne le RLS : tout filtre sur agency_id vient
// de la session, jamais de la requête.
export async function authorizeCase(caseId: string) {
  const caller = await requireMember();
  if (!caller) return { ok: false as const, response: fail("Accès refusé", 403) };

  if (!z.string().uuid().safeParse(caseId).success) {
    return {
      ok: false as const,
      response: fail("Identifiant invalide", 400),
    };
  }

  const agencyId = caller.profile.agency_id as string;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cases")
    .select("id")
    .eq("id", caseId)
    .eq("agency_id", agencyId)
    .maybeSingle();

  if (error) {
    console.error("[authorize case] lecture du dossier", error.code);
    return { ok: false as const, response: fail("Erreur serveur", 500) };
  }
  if (!data) {
    return { ok: false as const, response: fail("Dossier introuvable", 404) };
  }
  return { ok: true as const, caller, agencyId, admin };
}

export type AuthorizedCase = Extract<
  Awaited<ReturnType<typeof authorizeCase>>,
  { ok: true }
>;
