import "server-only";
import { cache } from "react";
import { ApiError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Subscription, SubscriptionState } from "../subscription";

// Abonnement d'une agence, lu par le serveur (clé secrète). Mis en cache
// pour la durée d'un affichage : coquille, layout et page le partagent.
// En cas d'erreur de lecture, l'agence est traitée comme active : la base
// reste seule juge des écritures.
export const getSubscription = cache(async (agencyId: string): Promise<Subscription> => {
  const { data, error } = await createAdminClient().rpc("agency_subscription", {
    p_agency_id: agencyId,
  });
  const row = (data as { ends_at: string; state: SubscriptionState }[] | null)?.[0];
  if (error || !row) {
    if (error) console.error("[subscription]", error.code);
    return { state: "active", endsAt: new Date(Date.now() + 365 * 86_400_000).toISOString() };
  }
  return { state: row.state, endsAt: row.ends_at };
});

export async function isReadOnly(agencyId: string): Promise<boolean> {
  return (await getSubscription(agencyId)).state === "expired";
}

// Pour les routes qui agissent hors de la base avant d'y écrire (stockage,
// comptes) : refuse tout de suite, avec le même message que la base
export async function requireWritableAgency(agencyId: string): Promise<void> {
  if (await isReadOnly(agencyId)) {
    throw new ApiError(403, "Abonnement expiré : votre agence est en lecture seule.");
  }
}

// Numéro affiché dans les bandeaux (réglage SUPPORT_PHONE, facultatif)
export function supportPhone(): string | null {
  return process.env.SUPPORT_PHONE?.trim() || null;
}
