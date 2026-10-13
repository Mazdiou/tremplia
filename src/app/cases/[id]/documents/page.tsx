import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSize } from "@/features/documents/format";
import { shortDateFormat } from "@/lib/dates";
import { getCase } from "@/features/cases/server/get-case";
import {
  DocumentsPanel,
  type DocItem,
  type FolderItem,
} from "@/features/documents/components/documents-panel";

type Row = {
  id: string;
  name: string;
  size_bytes: number;
  uploaded_by: string;
  folder_id: string | null;
  locked_at: string | null;
  created_at: string;
};

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getCase(id))) notFound();

  const caller = await requireMember();
  const isOwner = caller?.isOwner === true;

  // Les 4 dossiers de départ sont créés une seule fois par dossier candidat
  // (la fonction SQL est sans effet si c'est déjà fait). Un échec ne bloque
  // pas la page : les documents restent visibles dans « Sans dossier ».
  if (caller) {
    const { error: initError } = await createAdminClient().rpc(
      "ensure_default_document_folders",
      {
        p_case_id: id,
        p_agency_id: caller.agencyId,
        p_actor_id: caller.userId,
      },
    );
    if (initError) {
      console.error("[documents folders init]", initError.message);
    }
  }

  // Lecture via le RLS : seuls les documents de l'agence reviennent.
  const supabase = await createClient();

  const { data: folderRows } = await supabase
    .from("document_folders")
    .select("id, name")
    .eq("case_id", id)
    .order("created_at", { ascending: true });
  const folders = (folderRows ?? []) as FolderItem[];

  const { data } = await supabase
    .from("documents")
    .select(
      "id, name, size_bytes, uploaded_by, folder_id, locked_at, created_at",
    )
    .eq("case_id", id)
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Row[];

  const names = new Map<string, string>();
  const authorIds = [...new Set(rows.map((r) => r.uploaded_by))];
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, first_name")
      .in("id", authorIds);
    for (const p of (profiles ?? []) as { id: string; first_name: string }[]) {
      names.set(p.id, p.first_name);
    }
  }

  const docs: DocItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sizeLabel: formatSize(r.size_bytes),
    uploadedBy: names.get(r.uploaded_by) ?? "un ancien membre",
    dateLabel: shortDateFormat.format(new Date(r.created_at)),
    locked: r.locked_at !== null,
    folderId: r.folder_id,
  }));

  return (
    <DocumentsPanel
      caseId={id}
      docs={docs}
      folders={folders}
      isOwner={isOwner}
    />
  );
}
