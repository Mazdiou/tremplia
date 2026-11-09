import "server-only";
import { dbError } from "@/lib/api-errors";
import type { Member } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingProgress } from "../steps";
import { reportError } from "@/lib/report-error";

// Guide de démarrage (migration onboarding). Les lectures ne font jamais
// échouer la page : en cas d'erreur, le guide et le mot de bienvenue ne
// s'affichent simplement pas.

// Avancement du guide du patron, ou null s'il est masqué (ou illisible)
export async function loadOnboarding(owner: Member): Promise<OnboardingProgress | null> {
  if (!owner.isOwner) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .rpc("onboarding_progress", {
      p_agency_id: owner.agencyId,
      p_actor_id: owner.userId,
    })
    .maybeSingle<{
      hidden: boolean;
      has_campaign: boolean;
      has_case: boolean;
      has_document: boolean;
      has_student_access: boolean;
      has_task: boolean;
      has_employee: boolean;
      // Absente tant que la migration onboarding_signup n'est pas appliquée
      has_signup_page?: boolean;
      latest_case_id: string | null;
    }>();
  if (error) reportError("[onboarding read]", error.code);
  if (!data || data.hidden) return null;
  return {
    hasCampaign: data.has_campaign,
    hasCase: data.has_case,
    hasDocument: data.has_document,
    hasStudentAccess: data.has_student_access,
    hasTask: data.has_task,
    hasEmployee: data.has_employee,
    hasSignupPage: data.has_signup_page ?? false,
    latestCaseId: data.latest_case_id,
  };
}

// Le guide est-il masqué ? (pour le réglage du patron)
export async function isOnboardingHidden(agencyId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agencies")
    .select("onboarding_hidden_at")
    .eq("id", agencyId)
    .maybeSingle();
  if (error) reportError("[onboarding hidden]", error.code);
  return !data || data.onboarding_hidden_at !== null;
}

// Mot de bienvenue encore à voir ?
export async function needsWelcome(member: Member): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("welcomed_at")
    .eq("id", member.userId)
    .maybeSingle();
  if (error) reportError("[welcome read]", error.code);
  return !!data && data.welcomed_at === null;
}

export async function setOnboardingHidden(owner: Member, hidden: boolean) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("set_onboarding_hidden", {
    p_agency_id: owner.agencyId,
    p_actor_id: owner.userId,
    p_hidden: hidden,
  });
  if (error) throw dbError("onboarding hide", error);
}

export async function markWelcomed(member: Member) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("mark_welcomed", {
    p_agency_id: member.agencyId,
    p_user_id: member.userId,
  });
  if (error) throw dbError("onboarding welcome", error);
}
