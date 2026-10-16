import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

type Agency = { name: string; phone: string };

// Nom et téléphone de l'agence de la session (lecture via le RLS : seule la
// sienne est visible). Mis en cache pour la durée d'un affichage.
export const getAgency = cache(async (agencyId: string): Promise<Agency | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("agencies")
    .select("name, phone")
    .eq("id", agencyId)
    .maybeSingle();
  return (data as Agency | null) ?? null;
});
