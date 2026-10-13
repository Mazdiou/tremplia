import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import type { Member } from "@/lib/auth/require-member";
import { normalizeName } from "@/lib/names";
import { createClient } from "@/lib/supabase/server";
import {
  CASE_FIELD_COLUMNS,
  toCaseDraft,
  type CaseFieldsDraft,
  type CaseFieldsRecord,
} from "../case-record";

// Lectures via le RLS : seuls les dossiers de l'agence de l'appelant sont
// visibles. Appelées en POST : jamais l'identité d'un candidat dans une adresse.

const SEARCH_LIMIT = 20;

export type CaseSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  educationLevel: string;
  campaignId: string;
  campaignName: string;
};

// Échappe les jokers de LIKE (% et _) saisis par l'utilisateur
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

// Recherche globale dans l'agence : chaque mot doit apparaître dans le nom
// (sans accents ni majuscules), dans n'importe quel ordre. Une saisie faite
// de chiffres cherche dans les numéros de téléphone.
export async function searchCases(query: string): Promise<CaseSearchResult[]> {
  const supabase = await createClient();
  let request = supabase
    .from("cases")
    .select("id, first_name, last_name, status, education_level, campaign_id")
    .order("last_name")
    .order("first_name")
    .limit(SEARCH_LIMIT);

  const digits = query.replace(/[\s.+-]/g, "");
  if (/^\d{4,}$/.test(digits)) {
    request = request.ilike("phone", `%${likeEscape(digits)}%`);
  } else {
    for (const word of normalizeName(query).split(" ").filter(Boolean)) {
      request = request.ilike("search_name", `%${likeEscape(word)}%`);
    }
  }

  const { data, error } = await request;
  if (error) throw dbError("cases search", error);
  const rows = data ?? [];

  const campaignIds = [...new Set(rows.map((r) => r.campaign_id as string))];
  const names = new Map<string, string>();
  if (campaignIds.length > 0) {
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name")
      .in("id", campaignIds);
    if (campaignsError) throw dbError("cases search campaigns", campaignsError);
    for (const c of campaigns ?? []) names.set(c.id as string, c.name as string);
  }

  return rows.map((r) => ({
    id: r.id as string,
    firstName: r.first_name as string,
    lastName: r.last_name as string,
    status: r.status as string,
    educationLevel: r.education_level as string,
    campaignId: r.campaign_id as string,
    campaignName: names.get(r.campaign_id as string) ?? "",
  }));
}

export type ImportMatch = {
  id: string;
  status: string;
  fields: CaseFieldsDraft;
  // Comptes repris SANS mot de passe : il est à ressaisir
  externalAccounts: {
    platform: string;
    url: string;
    login: string;
    status: "existing" | "to_create";
  }[];
};

// Import depuis une autre campagne : dossiers de la campagne source qui ont
// ce nom, ce prénom et cette date de naissance (noms comparés sans accents
// ni majuscules). Groupes, notes, documents, responsable et statut ne sont
// jamais repris.
export async function findImportMatches(
  member: Member,
  input: { sourceCampaignId: string; lastName: string; firstName: string; birthDate: string },
): Promise<ImportMatch[]> {
  const supabase = await createClient();

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", input.sourceCampaignId)
    .eq("agency_id", member.agencyId)
    .maybeSingle();
  if (campaignError) throw dbError("cases import lookup", campaignError);
  if (!campaign) throw new ApiError(404, "Campagne introuvable");

  const { data, error } = await supabase
    .from("cases")
    .select(["id", "status", ...CASE_FIELD_COLUMNS].join(", "))
    .eq("campaign_id", input.sourceCampaignId)
    .eq("birth_date", input.birthDate);
  if (error) throw dbError("cases import lookup", error);

  const first = normalizeName(input.firstName);
  const last = normalizeName(input.lastName);
  const rows = (data ?? []) as unknown as (CaseFieldsRecord & { id: string; status: string })[];
  const matches = rows.filter(
    (r) => normalizeName(r.first_name) === first && normalizeName(r.last_name) === last,
  );
  if (matches.length === 0) return [];

  const { data: accounts, error: accountsError } = await supabase
    .from("case_external_accounts")
    .select("case_id, platform, url, login")
    .in(
      "case_id",
      matches.map((m) => m.id),
    )
    .order("platform");
  if (accountsError) throw dbError("cases import lookup accounts", accountsError);

  return matches.map((m) => ({
    id: m.id,
    status: m.status,
    fields: toCaseDraft(m),
    externalAccounts: (accounts ?? [])
      .filter((a) => a.case_id === m.id)
      .map((a) => ({
        platform: a.platform as string,
        url: (a.url as string | null) ?? "",
        login: (a.login as string | null) ?? "",
        // Sans identifiant connu, le compte reste « à créer »
        status: a.login ? ("existing" as const) : ("to_create" as const),
      })),
  }));
}
