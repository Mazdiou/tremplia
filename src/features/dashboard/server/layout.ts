import "server-only";
import { dbError } from "@/lib/api-errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportError } from "@/lib/report-error";
import type { Member } from "@/lib/auth/require-member";
import { DEFAULT_LAYOUT, parseLayout, type LayoutItem } from "../widgets";

// Disposition du tableau de bord (migration dashboard_layouts). Clé secrète :
// toujours filtrée sur l'agence et le membre de la session.

export type DashboardLayouts = {
  // Celle que le membre voit : la sienne, sinon celle de l'agence, sinon
  // celle de l'application
  layout: LayoutItem[];
  personal: boolean;
  // Disposition de départ du membre (bouton « Disposition de départ »)
  fallback: LayoutItem[];
  // Le patron en a proposé une à l'équipe (il peut la retirer)
  agencyLayout: boolean;
};

export async function getDashboardLayouts(member: Member): Promise<DashboardLayouts> {
  const { data, error } = await createAdminClient()
    .from("dashboard_layouts")
    .select("user_id, layout")
    .eq("agency_id", member.agencyId)
    .or(`user_id.eq.${member.userId},user_id.is.null`);
  // Jamais d'erreur : le tableau de bord s'affiche dans sa disposition par défaut
  if (error) {
    reportError("[dashboard layout read]", error.code);
    return { layout: DEFAULT_LAYOUT, personal: false, fallback: DEFAULT_LAYOUT, agencyLayout: false };
  }
  const rows = (data ?? []) as { user_id: string | null; layout: unknown }[];
  const personal = parseLayout(rows.find((r) => r.user_id === member.userId)?.layout);
  const agency = parseLayout(rows.find((r) => r.user_id === null)?.layout);
  const fallback = agency ?? DEFAULT_LAYOUT;
  return {
    layout: personal ?? fallback,
    personal: personal !== null,
    fallback,
    agencyLayout: agency !== null,
  };
}

// Disposition du membre (vide : retour à celle de départ). Patron avec
// forAgency : la même devient aussi celle de l'agence.
export async function saveDashboardLayout(
  member: Member,
  layout: LayoutItem[] | null,
  forAgency: boolean,
) {
  const admin = createAdminClient();
  const save = (p_layout: LayoutItem[] | null, p_for_agency: boolean) =>
    admin.rpc("save_dashboard_layout", {
      p_agency_id: member.agencyId,
      p_user_id: member.userId,
      p_layout,
      p_for_agency,
    });

  const { error } = await save(layout, false);
  if (error) throw dbError("dashboard layout save", error, { "42501": "Accès refusé" });
  if (forAgency && layout) {
    const { error: agencyError } = await save(layout, true);
    if (agencyError) {
      throw dbError("dashboard layout save agency", agencyError, {
        "42501": "Réservé au patron",
      });
    }
  }
}

// Patron : retire la disposition proposée à l'équipe. Les membres qui n'ont
// pas la leur retrouvent celle de l'application ; celle du patron ne change pas.
export async function removeAgencyLayout(member: Member) {
  const { error } = await createAdminClient().rpc("save_dashboard_layout", {
    p_agency_id: member.agencyId,
    p_user_id: member.userId,
    p_layout: null,
    p_for_agency: true,
  });
  if (error) throw dbError("dashboard layout remove agency", error, { "42501": "Réservé au patron" });
}
