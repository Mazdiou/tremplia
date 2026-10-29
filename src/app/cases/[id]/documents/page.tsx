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
import { RequestsPanel } from "@/features/document-requests/components/requests-panel";
import { listCaseRequests } from "@/features/document-requests/server/read";
import { isStudentAccessEnabled } from "@/features/student/server/access";
import { reportError } from "@/lib/report-error";

type Row = {
  id: string;
  name: string;
  size_bytes: number;
  folder_id: string | null;
  locked_at: string | null;
  created_at: string;
  // Envoyé par le candidat depuis son espace (sans auteur parmi les membres)
  sent_by_student: boolean;
  // Auteur, par le lien du document (vide : envoyé par le candidat)
  uploader: { first_name: string } | null;
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

  // Les dossiers de départ sont créés une seule fois par dossier candidat
  // (cases.folders_initialized_at) : la fonction SQL n'est appelée que la
  // première fois. Un échec ne bloque pas la page : les documents restent
  // visibles dans « Sans catégorie ».
  if (caller && !readOnly && !found.c.folders_initialized_at) {
    const { error } = await createAdminClient().rpc("ensure_default_document_folders", {
      p_case_id: id,
      p_agency_id: caller.agencyId,
      p_actor_id: caller.userId,
    });
    if (error) reportError("[documents folders init]", error.code);
  }

  // Documents (avec le prénom de leur auteur, par leur lien) et dossiers de
  // rangement, lus ensemble via le RLS : seuls ceux de l'agence reviennent
  const [{ data }, { data: folderRows }, requests, accessEnabled] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, name, size_bytes, folder_id, locked_at, created_at, sent_by_student, uploader:profiles!documents_uploaded_by_fk(first_name)",
      )
      .eq("case_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("document_folders")
      .select("id, name")
      .eq("case_id", id)
      .order("created_at", { ascending: true }),
    listCaseRequests(id),
    caller ? isStudentAccessEnabled(caller.agencyId, id) : false,
  ]);
  const rows = (data ?? []) as unknown as Row[];
  const folders = (folderRows ?? []) as FolderItem[];

  const docs: DocItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    sizeLabel: formatSize(r.size_bytes),
    uploadedBy: r.sent_by_student ? "le candidat" : (r.uploader?.first_name ?? "un ancien membre"),
    dateLabel: shortDateFormat.format(new Date(r.created_at)),
    locked: r.locked_at !== null,
    folderId: r.folder_id,
  }));

  // Pourquoi le candidat ne voit pas encore les pièces demandées
  const accessNote =
    found.c.status === "abandoned"
      ? "Dossier abandonné : le candidat ne peut plus se connecter à son espace."
      : found.campaign?.status === "archived"
        ? "Campagne archivée : le candidat ne peut plus se connecter à son espace."
        : !accessEnabled
          ? "L'espace candidat est fermé. Ouvrez-le en haut du dossier pour qu'il voie ces pièces."
          : null;

  return (
    <div className="space-y-6">
      <RequestsPanel
        caseId={id}
        requests={requests}
        folders={folders}
        accessNote={accessNote}
        readOnly={readOnly}
      />
      <DocumentsPanel
        caseId={id}
        docs={docs}
        folders={folders}
        isOwner={isOwner}
        readOnly={readOnly}
      />
    </div>
  );
}
