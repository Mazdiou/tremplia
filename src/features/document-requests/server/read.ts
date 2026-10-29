import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { shortDateFormat } from "@/lib/dates";
import { formatSize } from "@/features/documents/format";
import { reportError } from "@/lib/report-error";
import type { RequestItem } from "../types";

// Pièces demandées d'un dossier, côté agence. Lues via le RLS : seules
// celles de l'agence de la session reviennent.

type Row = {
  id: string;
  label: string;
  folder_id: string | null;
  accepted_at: string | null;
  document: {
    id: string;
    original_file_name: string;
    size_bytes: number;
    created_at: string;
    locked_at: string | null;
  } | null;
};

export async function listCaseRequests(caseId: string): Promise<RequestItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("case_document_requests")
    .select(
      "id, label, folder_id, accepted_at, document:documents!case_document_requests_document_fk(id, original_file_name, size_bytes, created_at, locked_at)",
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });
  if (error) reportError("[document requests read]", error.code);

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    label: r.label,
    folderId: r.folder_id,
    status: !r.document ? "pending" : r.accepted_at ? "accepted" : "received",
    document: r.document && {
      id: r.document.id,
      fileName: r.document.original_file_name,
      sizeLabel: formatSize(r.document.size_bytes),
      dateLabel: shortDateFormat.format(new Date(r.document.created_at)),
      locked: r.document.locked_at !== null,
    },
  }));
}

// Pièces reçues pas encore acceptées (pastille de l'onglet Documents)
export const countRequestsToCheck = cache(async (caseId: string): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("case_document_requests")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId)
    .not("document_id", "is", null)
    .is("accepted_at", null);
  if (error) reportError("[document requests count]", error.code);
  return count ?? 0;
});
