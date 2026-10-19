import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fullName } from "@/lib/names";
import { reportError } from "@/lib/report-error";

// « Prénom Nom » des membres demandés, par identifiant ; un compte supprimé
// n'y figure pas. `agencyId` est obligatoire avec la clé secrète, qui ne
// passe pas par le RLS.
export async function memberNames(
  supabase: SupabaseClient,
  ids: string[],
  agencyId?: string,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;
  let query = supabase.from("profiles").select("id, first_name, last_name").in("id", ids);
  if (agencyId) query = query.eq("agency_id", agencyId);
  const { data, error } = await query;
  if (error) reportError("[member names]", error.code);
  for (const p of (data ?? []) as { id: string; first_name: string; last_name: string }[]) {
    names.set(p.id, fullName(p.first_name, p.last_name));
  }
  return names;
}
