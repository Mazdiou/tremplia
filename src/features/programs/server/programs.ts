import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import {
  logCaseActivity,
  type AuthorizedCase,
} from "@/features/cases/server/authorize-case";
import type { ProgramInput, ProgramResult } from "@/features/programs/schemas";

// Formations visées par le candidat, dans l'ordre de préférence. Tout membre
// actif les gère (revérifié par les fonctions SQL, qui gardent l'ordre sans
// trou). Le journal garde l'intitulé : ce n'est pas une donnée personnelle.

const MESSAGES = {
  P0002: "Formation introuvable",
  "23514": "Formation invalide",
  "54000": "20 formations au maximum par dossier",
};

function fields(input: ProgramInput) {
  return {
    p_title: input.title,
    p_level: input.level,
    p_city: input.city,
    p_institution: input.institution ?? null,
  };
}

// Tout membre actif
export async function createProgram(auth: AuthorizedCase, caseId: string, input: ProgramInput) {
  const { data, error } = await auth.admin.rpc("create_case_program", {
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    ...fields(input),
  });
  if (error) {
    throw dbError("programs create", error, { ...MESSAGES, P0002: "Dossier introuvable" });
  }
  if (typeof data !== "string") throw new ApiError(500, "Impossible d'ajouter la formation");

  await logCaseActivity(auth, caseId, {
    action: "program.created",
    targetType: "case_program",
    targetId: data,
    details: { title: input.title },
  });
  return data;
}

export async function updateProgram(
  auth: AuthorizedCase,
  caseId: string,
  programId: string,
  input: ProgramInput,
) {
  const { data: changed, error } = await auth.admin.rpc("update_case_program", {
    p_program_id: programId,
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    ...fields(input),
  });
  if (error) throw dbError("programs update", error, MESSAGES);

  if (changed === true) {
    await logCaseActivity(auth, caseId, {
      action: "program.updated",
      targetType: "case_program",
      targetId: programId,
      details: { title: input.title },
    });
  }
}

export async function deleteProgram(auth: AuthorizedCase, caseId: string, programId: string) {
  const { error } = await auth.admin.rpc("delete_case_program", {
    p_program_id: programId,
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
  });
  if (error) throw dbError("programs delete", error, MESSAGES);

  await logCaseActivity(auth, caseId, {
    action: "program.deleted",
    targetType: "case_program",
    targetId: programId,
  });
}

// Réponse de l'établissement (tout membre actif). Ne redemande pas l'avis du
// candidat : elle ne fait pas partie de ce qu'il valide.
export async function setProgramResult(
  auth: AuthorizedCase,
  caseId: string,
  programId: string,
  result: ProgramResult,
) {
  const { data: changed, error } = await auth.admin.rpc("set_case_program_result", {
    p_program_id: programId,
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_result: result,
  });
  if (error) throw dbError("programs result", error, MESSAGES);

  if (changed === true) {
    await logCaseActivity(auth, caseId, {
      action: "program.result_set",
      targetType: "case_program",
      targetId: programId,
      details: { result },
    });
  }
}

// Monter (-1) ou descendre (+1) d'un rang ; rien en tête ou en fin de liste
export async function moveProgram(
  auth: AuthorizedCase,
  caseId: string,
  programId: string,
  direction: -1 | 1,
) {
  const { data: moved, error } = await auth.admin.rpc("move_case_program", {
    p_program_id: programId,
    p_case_id: caseId,
    p_agency_id: auth.agencyId,
    p_actor_id: auth.member.userId,
    p_direction: direction,
  });
  if (error) throw dbError("programs move", error, MESSAGES);

  if (moved === true) {
    await logCaseActivity(auth, caseId, {
      action: "program.moved",
      targetType: "case_program",
      targetId: programId,
      details: { direction },
    });
  }
}
