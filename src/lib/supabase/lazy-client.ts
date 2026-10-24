import type { SupabaseClient } from "@supabase/supabase-js";

// Client Supabase du navigateur, chargé seulement au premier besoin : la
// bibliothèque pèse lourd et ne sert, dans l'application, qu'au temps réel,
// à la déconnexion et à l'envoi de fichiers. Les pages s'affichent sans
// l'attendre. Les pages de connexion, qui s'en servent tout de suite,
// gardent l'import direct (client.ts).
export async function loadClient(): Promise<SupabaseClient> {
  const { createClient } = await import("./client");
  return createClient();
}
