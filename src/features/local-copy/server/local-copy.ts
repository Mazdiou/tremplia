import "server-only";
import { ApiError, dbError } from "@/lib/api-errors";
import { logActivity } from "@/lib/audit/log-activity";
import type { Member } from "@/lib/auth/require-member";
import { reportError } from "@/lib/report-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/supabase/read-all";
import { DOCUMENTS_BUCKET } from "@/features/documents/schemas";
import type { PlanData } from "../plan";

// Copie des documents sur l'ordinateur (voir ../sync.ts) : le serveur donne
// la liste à copier et des liens de téléchargement ; le navigateur écrit.
// Tout membre actif, comme l'ouverture d'un document ou l'archive ZIP.

const EMPTY: PlanData = {
  campaigns: [],
  groups: [],
  cases: [],
  caseGroups: [],
  folders: [],
  documents: [],
};

const CASE_COLUMNS = "id, campaign_id, first_name, last_name, created_at";
const DOC_COLUMNS = "id, case_id, folder_id, name, created_at, updated_at, size_bytes";

// Lu via le RLS (l'agence de la session) : les dossiers en cours des
// campagnes en cours, comme l'arbre par défaut. Avec `caseId`, seulement de
// quoi placer ce candidat (les autres dossiers de sa campagne servent aux
// noms en double) ; un dossier clos ou une campagne archivée donne une liste
// vide, et sa copie est retirée.
export async function getCopyPlanData(caseId?: string): Promise<PlanData> {
  const supabase = await createClient();
  const fail = (what: string) => (e: unknown) => {
    reportError(`[local copy ${what}]`, e instanceof Error ? e.message : "erreur");
    throw new ApiError(500, "Impossible de préparer la copie");
  };

  let campaigns: PlanData["campaigns"];
  if (caseId) {
    const { data: c, error } = await supabase
      .from("cases")
      .select("campaign_id, status")
      .eq("id", caseId)
      .maybeSingle();
    if (error) throw dbError("local copy case", error);
    if (!c) throw new ApiError(404, "Dossier introuvable");
    if (c.status !== "active") return EMPTY;
    const { data: camp, error: campError } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("id", c.campaign_id as string)
      .eq("status", "active")
      .maybeSingle();
    if (campError) throw dbError("local copy campaign", campError);
    if (!camp) return EMPTY;
    campaigns = [camp as PlanData["campaigns"][number]];
  } else {
    const { data, error } = await supabase
      .from("campaigns")
      .select("id, name")
      .eq("status", "active");
    if (error) throw dbError("local copy campaigns", error);
    campaigns = (data ?? []) as PlanData["campaigns"];
  }
  const campaignIds = campaigns.map((c) => c.id);
  if (campaignIds.length === 0) return EMPTY;

  const [groups, cases, caseGroups] = await Promise.all([
    readAll<PlanData["groups"][number]>((from, to) =>
      supabase
        .from("campaign_groups")
        .select("id, campaign_id, name, position")
        .in("campaign_id", campaignIds)
        .order("id")
        .range(from, to),
    ),
    readAll<PlanData["cases"][number]>((from, to) =>
      supabase
        .from("cases")
        .select(CASE_COLUMNS)
        .in("campaign_id", campaignIds)
        .eq("status", "active")
        .order("id")
        .range(from, to),
    ),
    readAll<PlanData["caseGroups"][number]>((from, to) =>
      supabase
        .from("case_groups")
        .select("case_id, group_id")
        .in("campaign_id", campaignIds)
        .order("case_id")
        .order("group_id")
        .range(from, to),
    ),
  ]).catch(fail("tree"));

  // Documents et dossiers de rangement : du candidat seul, ou de toute
  // l'agence (filtrés ensuite sur les dossiers retenus)
  const [folders, documents] = await Promise.all([
    readAll<PlanData["folders"][number]>((from, to) => {
      const q = supabase.from("document_folders").select("id, case_id, name");
      return (caseId ? q.eq("case_id", caseId) : q).order("id").range(from, to);
    }),
    readAll<PlanData["documents"][number]>((from, to) => {
      const q = supabase.from("documents").select(DOC_COLUMNS);
      return (caseId ? q.eq("case_id", caseId) : q).order("id").range(from, to);
    }),
  ]).catch(fail("documents"));

  const kept = new Set(cases.map((c) => c.id));
  return {
    campaigns,
    groups,
    cases,
    caseGroups,
    folders: folders.filter((f) => kept.has(f.case_id)),
    documents: documents.filter((d) => kept.has(d.case_id)),
  };
}

// Liens signés (5 minutes) d'un lot de documents de l'agence
export async function signCopyUrls(
  member: Member,
  input: { ids: string[]; caseId?: string; logCount?: number },
): Promise<{ id: string; url: string }[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("documents")
    .select("id, storage_path")
    .in("id", input.ids)
    .eq("agency_id", member.agencyId);
  if (error) throw dbError("local copy urls", error);
  const docs = (data ?? []) as { id: string; storage_path: string }[];
  if (docs.length === 0) return [];

  const { data: signed, error: signError } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrls(
      docs.map((d) => d.storage_path),
      300,
    );
  if (signError || !signed) {
    reportError("[local copy urls]", signError?.name ?? "erreur");
    throw new ApiError(500, "Impossible de préparer la copie");
  }
  const urlByPath = new Map(signed.map((s) => [s.path, s.signedUrl]));

  if (input.logCount) {
    await logActivity(admin, {
      agencyId: member.agencyId,
      actorId: member.userId,
      action: "document.copied_locally",
      ...(input.caseId ? { caseId: input.caseId, targetType: "case" as const, targetId: input.caseId } : {}),
      details: { documents: input.logCount },
    });
  }

  return docs.flatMap((d) => {
    const url = urlByPath.get(d.storage_path);
    return url ? [{ id: d.id, url }] : [];
  });
}
