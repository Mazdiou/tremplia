import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError, dbError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { encryptSecret } from "@/lib/crypto/secrets";
import { normalizeName } from "@/lib/names";
import { createAdminClient } from "@/lib/supabase/admin";
import { diffCase } from "../case-diff";
import {
  CASE_FIELD_COLUMNS,
  toCaseRecord,
  type CaseFieldsRecord,
} from "../case-record";
import type { CaseStatus } from "../labels";
import type { CreateCaseInput, UpdateCaseInput } from "../schemas";
import { logCaseActivity, type AuthorizedCase } from "./authorize-case";

// Création d'un dossier

// Même nom, même prénom (normalisés) et même date de naissance dans la même
// campagne. Simple avertissement : la création reste possible après accord.
async function findPossibleDuplicates(
  member: Member,
  input: CreateCaseInput,
): Promise<string[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cases")
    .select("id, first_name, last_name")
    .eq("agency_id", member.agencyId)
    .eq("campaign_id", input.campaignId)
    .eq("birth_date", input.birthDate);
  if (error) throw dbError("cases duplicates", error);

  const first = normalizeName(input.firstName);
  const last = normalizeName(input.lastName);
  return (data ?? [])
    .filter(
      (c) =>
        normalizeName(c.first_name) === first && normalizeName(c.last_name) === last,
    )
    .map((c) => c.id as string);
}

// Campagne source d'un import : retenue pour le journal seulement si elle
// est bien de l'agence (jamais de donnée personnelle dans le journal).
async function verifiedSourceCampaign(member: Member, id: string | undefined) {
  if (!id) return null;
  const { data } = await createAdminClient()
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("agency_id", member.agencyId)
    .maybeSingle();
  return data ? id : null;
}

export async function createCase(member: Member, input: CreateCaseInput) {
  if (!input.confirmDuplicate) {
    const duplicates = await findPossibleDuplicates(member, input);
    if (duplicates.length > 0) {
      throw new ApiError(
        409,
        "Un dossier avec ce nom, ce prénom et cette date de naissance existe déjà dans cette campagne",
        { code: "possible_duplicate", duplicates },
      );
    }
  }

  const caseId = randomUUID();
  // Le patron choisit le responsable (lui-même par défaut) ; un employé est
  // toujours responsable de ses dossiers. La base revérifie cette règle.
  const assignedTo = member.isOwner ? (input.assignedTo ?? member.userId) : member.userId;

  // Chaque mot de passe est chiffré ici, lié à son compte (identifiant choisi
  // avant l'appel) : il n'arrive jamais en clair dans la base.
  const accounts = input.externalAccounts.map((a) => {
    const id = randomUUID();
    const encrypted = a.password
      ? encryptSecret(a.password, `${member.agencyId}:${id}`)
      : null;
    return {
      id,
      platform: a.platform,
      url: a.url ?? null,
      login: a.login ?? null,
      status: a.status,
      password_encrypted: encrypted?.value ?? null,
      key_version: encrypted?.keyVersion ?? 1,
    };
  });

  const admin = createAdminClient();
  const { error } = await admin.rpc("create_case", {
    p_case_id: caseId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_campaign_id: input.campaignId,
    p_assigned_to: assignedTo,
    p_fields: toCaseRecord(input),
    p_group_ids: input.groupIds,
    p_accounts: accounts,
    p_initial_note: input.initialNote ?? null,
    p_agreed_amount: input.agreedAmount ?? null,
    p_initial_payment: input.initialPayment ?? null,
  });
  if (error) {
    throw dbError("cases create", error, {
      "55000": "Cette campagne est archivée : elle ne reçoit plus de dossier",
      "23503": "Campagne ou groupe introuvable",
      "23505": "Un seul compte par plateforme",
      "22023": "Données invalides (responsable inactif ?)",
      "22003": "Le paiement dépasse le montant convenu",
    });
  }

  const sourceCampaignId = await verifiedSourceCampaign(member, input.sourceCampaignId);
  await logActivity(admin, {
    agencyId: member.agencyId,
    actorId: member.userId,
    action: "case.created",
    targetType: "case",
    targetId: caseId,
    caseId,
    details: {
      campaign_id: input.campaignId,
      source_campaign_id: sourceCampaignId,
      assigned_to: assignedTo,
      groups: input.groupIds.length,
      external_accounts: accounts.length,
      initial_note: Boolean(input.initialNote),
      agreed_amount: input.agreedAmount ?? null,
      initial_payment: input.initialPayment?.amount ?? null,
    },
  });

  return caseId;
}

// Modification

export async function updateCase(auth: AuthorizedCase, caseId: string, input: UpdateCaseInput) {
  const { admin, member } = auth;
  const { data: current, error: readError } = await admin
    .from("cases")
    .select([...CASE_FIELD_COLUMNS, "assigned_to"].join(", "))
    .eq("id", caseId)
    .eq("agency_id", member.agencyId)
    .maybeSingle();
  if (readError) throw dbError("cases update read", readError);
  if (!current) throw new ApiError(404, "Dossier introuvable");

  const row = current as unknown as CaseFieldsRecord & { assigned_to: string | null };
  const { patch, fields, changes } = diffCase(row, toCaseRecord(input));

  if (fields.length > 0) {
    const { error } = await admin.rpc("update_case", {
      p_case_id: caseId,
      p_agency_id: member.agencyId,
      p_actor_id: member.userId,
      p_fields: patch,
    });
    if (error) throw dbError("cases update", error, { P0002: "Dossier introuvable" });

    await logCaseActivity(auth, caseId, {
      action: "case.updated",
      targetType: "case",
      targetId: caseId,
      details: { fields, ...changes },
    });
  }

  // Responsable : seul le patron le change. Pour un employé, assignedTo est
  // ignoré, quoi que dise la requête (la base refuserait de toute façon).
  const nextAssignee = member.isOwner ? input.assignedTo : undefined;
  if (nextAssignee && nextAssignee !== row.assigned_to) {
    const { error } = await admin.rpc("set_case_assignee", {
      p_case_id: caseId,
      p_agency_id: member.agencyId,
      p_actor_id: member.userId,
      p_assigned_to: nextAssignee,
    });
    if (error) {
      throw dbError("cases assign", error, {
        "22023": "Responsable invalide (compte inactif ou d'une autre agence)",
      });
    }
    await logCaseActivity(auth, caseId, {
      action: "case.assigned",
      targetType: "case",
      targetId: caseId,
      details: { from: row.assigned_to, to: nextAssignee },
    });
    fields.push("assigned_to");
  }

  return fields;
}

export async function setCaseStatus(
  auth: AuthorizedCase,
  caseId: string,
  status: CaseStatus,
  { completeTasks = false }: { completeTasks?: boolean } = {},
) {
  const { admin, member } = auth;
  const params = {
    p_case_id: caseId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_status: status,
  };
  // En fermant le dossier, ses tâches à faire peuvent être cochées dans la
  // même transaction : jamais un dossier clos avec des tâches restées à faire
  let previous: string;
  let completed = 0;
  if (completeTasks && status !== "active") {
    const { data, error } = await admin
      .rpc("close_case_with_tasks", params)
      .single<{ previous_status: string; completed_count: number }>();
    if (error) throw dbError("cases status", error, { P0002: "Dossier introuvable" });
    previous = data.previous_status;
    completed = data.completed_count;
  } else {
    const { data, error } = await admin.rpc("set_case_status", params);
    if (error) throw dbError("cases status", error, { P0002: "Dossier introuvable" });
    previous = data as string;
  }

  if (previous !== status) {
    await logCaseActivity(auth, caseId, {
      action: "case.status_changed",
      targetType: "case",
      targetId: caseId,
      details: { from: previous, to: status },
    });
  }
  if (completed > 0) {
    await logCaseActivity(auth, caseId, {
      action: "task.all_completed",
      targetType: "case",
      targetId: caseId,
      details: { count: completed },
    });
  }
}

// Remplace le classement du dossier dans les groupes de sa campagne
export async function setCaseGroups(auth: AuthorizedCase, caseId: string, groupIds: string[]) {
  const { admin, member } = auth;
  const { data: before, error: readError } = await admin
    .from("case_groups")
    .select("group_id")
    .eq("case_id", caseId)
    .eq("agency_id", member.agencyId);
  if (readError) throw dbError("cases groups read", readError);

  const { error } = await admin.rpc("set_case_groups", {
    p_case_id: caseId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_group_ids: groupIds,
  });
  if (error) {
    throw dbError("cases groups", error, {
      "23503": "Groupe introuvable dans la campagne de ce dossier",
      P0002: "Dossier introuvable",
    });
  }

  const old = new Set((before ?? []).map((g) => g.group_id as string));
  const next = new Set(groupIds);
  const added = [...next].filter((g) => !old.has(g));
  const removed = [...old].filter((g) => !next.has(g));
  if (added.length > 0 || removed.length > 0) {
    await logCaseActivity(auth, caseId, {
      action: "case.groups_updated",
      targetType: "case",
      targetId: caseId,
      details: { added, removed },
    });
  }
}
