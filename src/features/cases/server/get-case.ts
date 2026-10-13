import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type CaseRow = {
  id: string;
  campaign_id: string;
  assigned_to: string | null;
  first_name: string;
  last_name: string;
  birth_date: string;
  phone: string;
  email: string | null;
  education_level: string;
  main_track: string | null;
  schools: boolean;
  scope: string;
  pastel_account: "to_create" | "existing";
  pastel_email: string | null;
  language_tests: string[];
  diplomas: string[];
  status: "active" | "closed" | "abandoned";
  created_at: string;
};

// Mis en cache pour la durée de la requête : le layout, la page et la page
// de modification partagent la même lecture. Lecture via le RLS : un dossier
// d'une autre agence n'est jamais trouvé (donc « introuvable » partout).
export const getCase = cache(async (id: string) => {
  if (!z.string().uuid().safeParse(id).success) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const c = data as CaseRow;

  const [respRes, campRes] = await Promise.all([
    c.assigned_to
      ? supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", c.assigned_to)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("campaigns")
      .select("label")
      .eq("id", c.campaign_id)
      .maybeSingle(),
  ]);

  const p = respRes.data as { first_name: string; last_name: string } | null;
  return {
    c,
    responsible: p ? `${p.first_name} ${p.last_name}` : null,
    campaignLabel: (campRes.data as { label: string } | null)?.label ?? null,
  };
});
