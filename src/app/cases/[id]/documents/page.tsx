import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth/require-member";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isReadOnly } from "@/features/subscription/server/subscription";
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
  const [found, caller, supabase] = await Promise.all([
    getCase(id),
    requireMember(),
    createClient(),
  ]);
  if (!found) notFound();
  const isOwner = caller?.isOwner === true;
  // Abonnement expiré : rien à créer (la base le refuserait)
  const readOnly = caller ? await isReadOnly(caller.agencyId) : false;

  // Les 4 dossiers de départ sont créés une seule fois par dossier candidat
  // (la fonction SQL est sans effet si c'est déjà fait). Un échec ne bloque
  // pas la page : les documents restent visibles dans « Sans dossier ».
  // Les documents (lecture via le RLS : seuls ceux de l'agence reviennent)
  // sont lus en même temps ; les dossiers, seulement une fois créés.
  const [initRes, { data }] = await Promise.all([
    caller && !readOnly
      ? createAdminClient().rpc("ensure_default_document_folders", {
          p_case_id: id,
          p_agency_id: caller.agencyId,
          p_actor_id: caller.userId,
        })
      : Promise.resolve({ error: null }),
    supabase
      .from("documents")
      .select(
        "id, name, size_bytes, uploaded_by, folder_id, locked_at, created_at",
      )
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (initRes.error) {
    console.error("[documents folders init]", initRes.error.code);
  }
  const rows = (data ?? []) as Row[];
  const authorIds = [...new Set(rows.map((r) => r.uploaded_by))];

  const [{ data: folderRows }, { data: profiles }] = await Promise.all([
    supabase
      .from("document_folders")
      .select("id, name")
      .eq("case_id", id)
      .order("created_at", { ascending: true }),
    authorIds.length > 0
      ? supabase.from("profiles").select("id, first_name").in("id", authorIds)
      : Promise.resolve({ data: [] }),
  ]);
  const folders = (folderRows ?? []) as FolderItem[];

  const names = new Map<string, string>();
  for (const p of (profiles ?? []) as { id: string; first_name: string }[]) {
    names.set(p.id, p.first_name);
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
