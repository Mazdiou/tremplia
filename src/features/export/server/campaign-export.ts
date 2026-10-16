import "server-only";
import { ApiError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { todayInAppTimezone } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { buildXlsx } from "@/lib/xlsx";
import { readAll } from "@/lib/supabase/read-all";
import {
  campaignWorkbook,
  exportFileName,
  type ExportCase,
  type ExportPayment,
  type ExportProgram,
} from "../campaign-workbook";

const CASE_COLUMNS =
  "id, first_name, last_name, birth_date, phone, email, city, nationality, " +
  "secondary_contact_name, secondary_contact_phone, education_level, current_field, " +
  "current_institution, diplomas, language_tests, status, assigned_to, created_at, " +
  "agreed_amount, paid_amount, remaining_amount, stage_id";

// Classeur Excel d'une campagne. Lecture via le RLS : une campagne d'une
// autre agence est introuvable et ses lignes ne reviennent pas.
export async function exportCampaign(member: Member, campaignId: string) {
  const supabase = await createClient();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error("lecture impossible");
  if (!campaign) throw new ApiError(404, "Campagne introuvable");

  const [cases, groupsRes, stagesRes, caseGroups, membersRes, programs, payments] = await Promise.all([
    readAll<ExportCase>((from, to) =>
      supabase.from("cases").select(CASE_COLUMNS).eq("campaign_id", campaignId).order("id").range(from, to),
    ),
    supabase.from("campaign_groups").select("id, name").eq("campaign_id", campaignId).order("position"),
    supabase.from("campaign_stages").select("id, name").eq("campaign_id", campaignId).order("position"),
    readAll<{ case_id: string; group_id: string }>((from, to) =>
      supabase
        .from("case_groups")
        .select("case_id, group_id")
        .eq("campaign_id", campaignId)
        .order("case_id")
        .order("group_id")
        .range(from, to),
    ),
    supabase.from("profiles").select("id, first_name, last_name"),
    // Formations et paiements : filtrés sur la campagne de leur dossier
    readAll<ExportProgram>((from, to) =>
      supabase
        .from("case_programs")
        .select("id, case_id, position, title, level, city, institution, result, cases!inner(campaign_id)")
        .eq("cases.campaign_id", campaignId)
        .order("id")
        .range(from, to),
    ),
    readAll<ExportPayment>((from, to) =>
      supabase
        .from("case_payments")
        .select(
          "id, case_id, amount, paid_on, method, note, created_by, cancelled_at, cancel_reason, cases!inner(campaign_id)",
        )
        .eq("cases.campaign_id", campaignId)
        .order("id")
        .range(from, to),
    ),
  ]);
  if (groupsRes.error || stagesRes.error || membersRes.error) throw new Error("lecture impossible");

  const workbook = buildXlsx(
    campaignWorkbook({
      cases,
      groups: groupsRes.data ?? [],
      stages: stagesRes.data ?? [],
      caseGroups,
      members: membersRes.data ?? [],
      programs,
      payments,
    }),
  );

  // Données personnelles en masse : l'export est inscrit au journal. En
  // lecture seule (abonnement expiré), le journal refuse l'écriture : l'export
  // reste permis, l'échec se voit dans les logs.
  await logActivity(createAdminClient(), {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "campaign.exported",
    targetType: "campaign",
    targetId: campaignId,
    details: { cases: cases.length },
  });

  return {
    fileName: exportFileName(campaign.name as string, todayInAppTimezone()),
    workbook,
  };
}
