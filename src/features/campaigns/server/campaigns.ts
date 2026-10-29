import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { createAdminClient } from "@/lib/supabase/admin";
import { findCampaignTemplate } from "@/config/campaign-templates";
import type { CampaignSettings } from "../schemas";

// Écritures des campagnes et de leurs groupes. Les fonctions SQL revérifient
// l'acteur et son rôle ; l'agence vient toujours de la session.

const NAME_TAKEN = { "23505": "Une campagne de votre agence porte déjà ce nom" };

async function create(
  member: Member,
  settings: CampaignSettings & { groups: string[]; stages: string[] },
  templateKey: string | null,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_campaign", {
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_name: settings.name,
    p_template_key: templateKey,
    p_suggested_platforms: settings.suggestedPlatforms,
    p_dates: settings.dates,
    p_infos: settings.infos,
    p_groups: settings.groups,
    p_default_fee: settings.defaultFee ?? null,
    p_stages: settings.stages,
  });
  if (error || typeof data !== "string") {
    throw error ? dbError("campaigns create", error, NAME_TAKEN) : new ApiError(500, "Une erreur est survenue. Réessayez dans un instant.");
  }
  return { admin, id: data };
}

export async function createCampaign(
  member: Member,
  input: CampaignSettings & { groups: string[]; stages: string[] },
) {
  const { admin, id } = await create(member, input, null);
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "campaign.created",
    targetType: "campaign",
    targetId: id,
  });
  return id;
}

// Copie d'un modèle préconfiguré : une seule fois par agence
export async function importCampaignTemplate(member: Member, templateKey: string) {
  const template = findCampaignTemplate(templateKey);
  if (!template) throw new ApiError(404, "Modèle introuvable");

  const admin = createAdminClient();
  const { count, error } = await admin
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", member.agencyId)
    .eq("template_key", template.key);
  if (error) throw dbError("campaigns import", error);
  if ((count ?? 0) > 0) {
    throw new ApiError(409, "Ce modèle est déjà importé dans votre agence");
  }

  const { id } = await create(member, template, template.key);
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "campaign.imported",
    targetType: "campaign",
    targetId: id,
    details: { template_key: template.key },
  });
  return id;
}

export async function updateCampaign(
  member: Member,
  campaignId: string,
  input: CampaignSettings,
) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("update_campaign", {
    p_campaign_id: campaignId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_name: input.name,
    p_suggested_platforms: input.suggestedPlatforms,
    p_dates: input.dates,
    p_infos: input.infos,
    p_default_fee: input.defaultFee ?? null,
  });
  if (error) {
    throw dbError("campaigns update", error, {
      ...NAME_TAKEN,
      P0002: "Campagne introuvable",
    });
  }
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "campaign.updated",
    targetType: "campaign",
    targetId: campaignId,
  });
}

export async function setCampaignArchived(
  member: Member,
  campaignId: string,
  archived: boolean,
) {
  const admin = createAdminClient();
  const { data: changed, error } = await admin.rpc("set_campaign_status", {
    p_campaign_id: campaignId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_status: archived ? "archived" : "active",
  });
  if (error) throw dbError("campaigns status", error, { P0002: "Campagne introuvable" });
  if (changed === true) {
    await logActivity(admin, {
      agencyId: member.agencyId,
      actorId: member.userId,
      action: archived ? "campaign.archived" : "campaign.unarchived",
      targetType: "campaign",
      targetId: campaignId,
    });
  }
}

export async function deleteCampaign(member: Member, campaignId: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("delete_campaign", {
    p_campaign_id: campaignId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
  });
  if (error) throw dbError("campaigns delete", error, { P0002: "Campagne introuvable" });
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "campaign.deleted",
    targetType: "campaign",
    targetId: campaignId,
  });
}

// Groupes (tout membre actif)

const GROUP_ERRORS = {
  "23505": "Un groupe de cette campagne porte déjà ce nom",
  "54000": "30 groupes au maximum par campagne",
};

// Le groupe doit appartenir à la campagne de l'adresse (et à l'agence)
async function findGroup(member: Member, campaignId: string, groupId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaign_groups")
    .select("id")
    .eq("id", groupId)
    .eq("campaign_id", campaignId)
    .eq("agency_id", member.agencyId)
    .maybeSingle();
  if (error) throw dbError("groups read", error);
  if (!data) throw new ApiError(404, "Groupe introuvable");
  return admin;
}

export async function createGroup(member: Member, campaignId: string, name: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_campaign_group", {
    p_campaign_id: campaignId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_name: name,
  });
  if (error || typeof data !== "string") {
    throw error
      ? dbError("groups create", error, { ...GROUP_ERRORS, P0002: "Campagne introuvable" })
      : new ApiError(500, "Une erreur est survenue. Réessayez dans un instant.");
  }
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "group.created",
    targetType: "campaign_group",
    targetId: data,
    details: { campaign_id: campaignId },
  });
  return data;
}

export async function renameGroup(
  member: Member,
  campaignId: string,
  groupId: string,
  name: string,
) {
  const admin = await findGroup(member, campaignId, groupId);
  const { error } = await admin.rpc("rename_campaign_group", {
    p_group_id: groupId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_name: name,
  });
  if (error) throw dbError("groups rename", error, { ...GROUP_ERRORS, P0002: "Groupe introuvable" });
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "group.renamed",
    targetType: "campaign_group",
    targetId: groupId,
    details: { campaign_id: campaignId },
  });
}

// Les dossiers du groupe restent : ils perdent seulement ce classement
export async function deleteGroup(member: Member, campaignId: string, groupId: string) {
  const admin = await findGroup(member, campaignId, groupId);
  const { count } = await admin
    .from("case_groups")
    .select("case_id", { count: "exact", head: true })
    .eq("group_id", groupId);

  const { error } = await admin.rpc("delete_campaign_group", {
    p_group_id: groupId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
  });
  if (error) throw dbError("groups delete", error, { P0002: "Groupe introuvable" });
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "group.deleted",
    targetType: "campaign_group",
    targetId: groupId,
    details: { campaign_id: campaignId, cases_unclassified: count ?? 0 },
  });
}
