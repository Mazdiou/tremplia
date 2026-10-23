import "server-only";
import { dbError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { UNCONFIRMED_DAYS } from "../schemas";

// Inscriptions jamais confirmées depuis UNCONFIRMED_DAYS jours : agence
// restée vide et compte supprimés (migration purge_unconfirmed). Lancé
// chaque matin (.github/workflows/taches-quotidiennes.yml). Renvoie le
// nombre de comptes.

export async function purgeUnconfirmedRegistrations(): Promise<number> {
  const { data, error } = await createAdminClient().rpc("purge_unconfirmed_registrations", {
    p_age: `${UNCONFIRMED_DAYS} days`,
  });
  if (error) throw dbError("purge unconfirmed", error);
  return typeof data === "number" ? data : 0;
}
