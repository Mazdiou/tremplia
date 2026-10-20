import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { ApiError } from "@/lib/api-errors";
import { can, parsePermissions, type Permission } from "@/lib/permissions";

export type Member = {
  userId: string;
  agencyId: string;
  isOwner: boolean;
  // Accordées par le patron (vide pour le patron, qui les a toutes : voir can)
  permissions: Permission[];
  firstName: string;
  lastName: string;
};

// Membre ACTIF connecté, ou null. Le RLS ne renvoie aucun profil à un compte
// désactivé. Un compte qui doit encore remplacer son mot de passe temporaire
// n'a accès à rien d'autre (la page de changement n'utilise pas ce contrôle).
// L'agence vient toujours d'ici, jamais de la requête.
// Mis en cache pour la durée d'un affichage : la coquille, le layout et la
// page partagent la même lecture (sans effet dans les routes API).
export const requireMember = cache(async (): Promise<Member | null> => {
  const supabase = await createClient();
  // Jeton vérifié sur place, sans appel au serveur d'authentification
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("agency_id, role, is_active, must_change_password, first_name, last_name, permissions")
    .eq("id", userId)
    .maybeSingle();

  if (!profile || !profile.is_active || profile.must_change_password) return null;
  return {
    userId,
    agencyId: profile.agency_id as string,
    isOwner: profile.role === "owner",
    permissions: parsePermissions(profile.permissions),
    firstName: profile.first_name as string,
    lastName: profile.last_name as string,
  };
});

// Pages réservées au patron : null pour un employé
export async function requireOwner(): Promise<Member | null> {
  const member = await requireMember();
  return member?.isOwner ? member : null;
}

// Pages ouvertes par une permission : null sans elle
export async function requirePermission(permission: Permission): Promise<Member | null> {
  const member = await requireMember();
  return member && can(member, permission) ? member : null;
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

// Contrôle de la route, en plus de celui des fonctions SQL (jamais à la place)
export async function requireApiPermission(permission: Permission): Promise<Member> {
  const member = await requireApiMember();
  if (!can(member, permission)) {
    throw new ApiError(403, "Vous n'avez pas la permission de faire cette action");
  }
  return member;
}
