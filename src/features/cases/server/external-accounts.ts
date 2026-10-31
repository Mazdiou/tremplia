import "server-only";
import { randomUUID } from "node:crypto";
import { ApiError, dbError } from "@/lib/api-errors";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import type { ExternalAccountInput } from "../schemas";
import { logCaseActivity, type AuthorizedCase } from "./authorize-case";
import { reportException } from "@/lib/report-error";

// Le mot de passe est lié à son compte : copié dans la ligne d'un autre
// compte, il ne se déchiffre pas.
const aad = (agencyId: string, accountId: string) => `${agencyId}:${accountId}`;

// Crée (accountId absent) ou modifie un compte externe du dossier.
// Jamais de valeur dans le journal : seulement ce qui a changé.
export async function saveExternalAccount(
  auth: AuthorizedCase,
  caseId: string,
  accountId: string | null,
  input: ExternalAccountInput,
) {
  const { admin, member } = auth;
  const id = accountId ?? randomUUID();
  const encrypted = input.password
    ? encryptSecret(input.password, aad(member.agencyId, id))
    : null;

  // Modification : le compte doit être celui de ce dossier
  if (accountId) {
    const { data, error } = await admin
      .from("case_external_accounts")
      .select("id")
      .eq("id", accountId)
      .eq("case_id", caseId)
      .eq("agency_id", member.agencyId)
      .maybeSingle();
    if (error) throw dbError("external accounts read", error);
    if (!data) throw new ApiError(404, "Compte introuvable");
  }

  const { data: created, error } = await admin.rpc("save_external_account", {
    p_account_id: id,
    p_case_id: caseId,
    p_agency_id: member.agencyId,
    p_actor_id: member.userId,
    p_platform: input.platform,
    p_url: input.url ?? null,
    p_login: input.login ?? null,
    p_status: input.status,
    p_password_encrypted: encrypted?.value ?? null,
    p_key_version: encrypted?.keyVersion ?? 1,
  });
  if (error) {
    throw dbError("external accounts save", error, {
      "23505": "Ce dossier a déjà un compte pour cette plateforme",
      "23514": "Identifiant et mot de passe requis pour un compte existant",
      "22023": "Un compte existant ne redevient pas « à créer »",
      "54000": "10 comptes au maximum par dossier",
      P0002: "Dossier introuvable",
    });
  }

  await logCaseActivity(auth, caseId, {
    action: "external_account.saved",
    targetType: "external_account",
    targetId: id,
    details: {
      created: created === true,
      status: input.status,
      password_changed: Boolean(encrypted),
    },
  });
  return id;
}

// Affiche un mot de passe (tout membre actif). Journal D'ABORD : si la trace
// ne peut pas être écrite, rien n'est déchiffré ni renvoyé.
export async function revealPassword(
  auth: AuthorizedCase,
  caseId: string,
  accountId: string,
) {
  const { admin, member } = auth;

  const { data: account, error: accountError } = await admin
    .from("case_external_accounts")
    .select("id")
    .eq("id", accountId)
    .eq("case_id", caseId)
    .eq("agency_id", member.agencyId)
    .maybeSingle();
  if (accountError) throw dbError("external accounts reveal", accountError);
  if (!account) throw new ApiError(404, "Compte introuvable");

  const { data: secret, error } = await admin
    .from("external_account_secrets")
    .select("password_encrypted")
    .eq("account_id", accountId)
    .eq("agency_id", member.agencyId)
    .maybeSingle();
  if (error) throw dbError("external accounts reveal", error);
  if (!secret) throw new ApiError(404, "Aucun mot de passe enregistré pour ce compte");

  const logged = await logCaseActivity(auth, caseId, {
    action: "external_account.password_viewed",
    targetType: "external_account",
    targetId: accountId,
  });
  if (!logged) throw new ApiError(503, "Action impossible pour le moment. Réessayez dans un instant.");

  try {
    return decryptSecret(secret.password_encrypted as string, aad(member.agencyId, accountId));
  } catch (e) {
    // Jamais de valeur dans les logs, seulement la nature de l'erreur
    reportException("[external accounts reveal] déchiffrement", e);
    throw new ApiError(500, "Impossible de lire le mot de passe");
  }
}

// Tous les comptes du dossier avec leur mot de passe, pour les remettre au
// candidat (tout membre actif). Comme pour un affichage : journal D'ABORD.
// Un compte « à créer » n'a ni identifiant ni mot de passe : il n'est pas
// remis.
export async function handOverAccounts(auth: AuthorizedCase, caseId: string) {
  const { admin, member } = auth;

  const { data: accounts, error: accountsError } = await admin
    .from("case_external_accounts")
    .select("id, platform, url, login")
    .eq("case_id", caseId)
    .eq("agency_id", member.agencyId)
    .eq("status", "existing");
  if (accountsError) throw dbError("external accounts handover", accountsError);
  if (!accounts?.length) throw new ApiError(404, "Aucun compte à remettre pour ce dossier");

  const { data: secrets, error } = await admin
    .from("external_account_secrets")
    .select("account_id, password_encrypted")
    .eq("agency_id", member.agencyId)
    .in(
      "account_id",
      accounts.map((a) => a.id),
    );
  if (error) throw dbError("external accounts handover", error);

  const logged = await logCaseActivity(auth, caseId, {
    action: "external_account.handed_over",
    targetType: "case",
    targetId: caseId,
    details: { count: accounts.length },
  });
  if (!logged) throw new ApiError(503, "Action impossible pour le moment. Réessayez dans un instant.");

  const encrypted = new Map(
    (secrets ?? []).map((s) => [s.account_id as string, s.password_encrypted as string]),
  );
  return [...accounts]
    .sort((a, b) => a.platform.localeCompare(b.platform))
    .map((a) => {
      let password: string | null = null;
      const value = encrypted.get(a.id);
      if (value) {
        try {
          password = decryptSecret(value, aad(member.agencyId, a.id));
        } catch (e) {
          // Mot de passe illisible : le compte est remis sans lui
          reportException("[external accounts handover] déchiffrement", e);
        }
      }
      return { platform: a.platform, url: a.url, login: a.login, password };
    });
}
