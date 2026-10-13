import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api-errors";

export type Member = {
  userId: string;
  agencyId: string;
  isOwner: boolean;
  firstName: string;
  lastName: string;
};

// Membre ACTIF connecté, ou null. Le RLS ne renvoie aucun profil à un compte
// désactivé. L'agence vient toujours d'ici, jamais de la requête.
export async function requireMember(): Promise<Member | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("agency_id, role, is_active, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) return null;
  return {
    userId: user.id,
    agencyId: profile.agency_id as string,
    isOwner: profile.role === "owner",
    firstName: profile.first_name as string,
    lastName: profile.last_name as string,
  };
}

// Pour les routes API : refuse (403) au lieu de renvoyer null
export async function requireApiMember(): Promise<Member> {
  const member = await requireMember();
  if (!member) throw new ApiError(403, "Accès refusé");
  return member;
}

// Contrôle de la route, en plus de celui des fonctions SQL (jamais à la place)
export async function requireApiOwner(): Promise<Member> {
  const member = await requireApiMember();
  if (!member.isOwner) throw new ApiError(403, "Action réservée au patron");
  return member;
}
