"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDragAutoScroll } from "@/features/documents/drag-autoscroll";
import { pdfProblem, uploadDocument, uploadSummary } from "@/features/documents/upload";
import { callApi } from "@/lib/api-client";
import { DownloadArchiveButton } from "./download-archive-button";
import { CaseCopyButton, useAutoCaseCopy } from "@/features/local-copy/components/case-copy-button";
import {
  DOC_DRAG_TYPE,
  DocumentRow,
  NO_FOLDER,
  type DocRowActions,
  type DocRowMode,
} from "./document-row";
import { FolderSection, type FolderActions, type FolderMode } from "./folder-section";
import { cn } from "@/lib/utils";
import { StatusMessage, type ActionMessage } from "@/components/page-ui";

export type DocItem = {
  id: string;
  name: string;
  sizeLabel: string;
  uploadedBy: string;
  dateLabel: string;
  locked: boolean;
  folderId: string | null;
};

export type FolderItem = { id: string; name: string };

const lockedMessage = (verb: string) =>
  `Ce document est verrouillé par le patron : il ne peut plus être ${verb}.`;

function hasType(e: React.DragEvent, type: string) {
  return Array.from(e.dataTransfer.types).includes(type);
}

export function DocumentsPanel({
  caseId,
  docs,
  folders,
  isOwner,
}: {
  caseId: string;
  docs: DocItem[];
  folders: FolderItem[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const base = `/api/cases/${caseId}/documents`;
  const foldersBase = `/api/cases/${caseId}/document-folders`;
  const inputRef = useRef<HTMLInputElement>(null);
  // La page défile quand on glisse près du haut ou du bas du contenu
  const rootRef = useRef<HTMLDivElement>(null);
  useDragAutoScroll(rootRef);
  // Dossier qui recevra les fichiers choisis avec le sélecteur de fichiers
  const uploadTarget = useRef<string | null>(null);

  const [message, setMessage] = useState<ActionMessage>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Un seul document à la fois est renommé, déplacé ou en attente de
  // confirmation de suppression
  const [row, setRow] = useState<{ id: string; mode: DocRowMode } | null>(null);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  // Dossiers de rangement
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragDocId, setDragDocId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderRow, setFolderRow] = useState<{ id: string; mode: FolderMode } | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);

  const say = (text: string, error = false) => setMessage({ text, error });

  const folderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);

  // Copie sur l'ordinateur : mise à jour dès que les documents changent
  const copySignature = useMemo(
    () =>
      JSON.stringify([
        docs.map((d) => [d.id, d.name, d.folderId]),
        folders.map((f) => [f.id, f.name]),
      ]),
    [docs, folders],
  );
  useAutoCaseCopy(caseId, copySignature, say);

  // Documents par section (un document dont le dossier est inconnu va dans « Sans dossier »)
  const byKey = useMemo(() => {
    const map = new Map<string, DocItem[]>();
    for (const d of docs) {
      const key = d.folderId && folderIds.has(d.folderId) ? d.folderId : NO_FOLDER;
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return map;
  }, [docs, folderIds]);

  async function uploadFiles(files: File[], folderId: string | null = null) {
    if (files.length === 0) return;
    setMessage(null);
    let added = 0;
    let lastError: string | null = null;

    for (const file of files) {
      const problem = pdfProblem(file);
      if (problem) {
        lastError = `${file.name} : ${problem}`;
        continue;
      }
      setUploading(file.name);
      const error = await uploadDocument(base, file, folderId);
      if (error) lastError = `${file.name} : ${error}`;
      else added += 1;
    }

    setUploading(null);
    const summary = uploadSummary(added, lastError);
    say(summary.text, summary.error);
    if (added > 0) router.refresh();
    if (inputRef.current) inputRef.current.value = "";
  }

  // --- Documents ---------------------------------------------------------------

  // Un document verrouillé ne se renomme, ne se déplace ni ne se supprime
  function startOn(d: DocItem, mode: DocRowMode, verb: string) {
    if (d.locked) {
      say(lockedMessage(verb), true);
      return;
    }
    setMessage(null);
    setRow({ id: d.id, mode });
  }

  // Déplace un document (bouton ou glisser-déposer) ; rien si déjà en place
  async function moveDoc(d: DocItem, folderId: string | null) {
    const current = d.folderId && folderIds.has(d.folderId) ? d.folderId : null;
    if (current === folderId) return;
    if (d.locked) {
      say(lockedMessage("déplacé"), true);
      return;
    }
    setMessage(null);
    setWorking(d.id);
    const res = await callApi(`${base}/${d.id}/move`, { body: { folderId } });
    setWorking(null);
    if (!res.ok) {
      say(res.error, true);
    } else {
      const target = folders.find((f) => f.id === folderId);
      say(target ? `Document déplacé dans « ${target.name} »` : "Document retiré de son dossier");
    }
    router.refresh();
  }

  const rowActions: DocRowActions = {
    async open(d) {
      setMessage(null);
      // Fenêtre ouverte tout de suite (clic de l'utilisateur) pour éviter le
      // blocage des fenêtres, puis dirigée vers le lien signé d'une minute.
      const win = window.open("about:blank", "_blank");
      const res = await callApi<{ url?: unknown }>(`${base}/${d.id}/open`);
      if (!res.ok || typeof res.data.url !== "string") {
        win?.close();
        say(res.ok ? "Impossible d'ouvrir le document" : res.error, true);
        return;
      }
      if (!win) {
        say("Le navigateur a bloqué l'ouverture. Autorisez les fenêtres pour ce site.", true);
        return;
      }
      win.opener = null;
      win.location.href = res.data.url;
    },
    startRename: (d) => startOn(d, "rename", "renommé"),
    async rename(d, value) {
      const name = value.trim();
      if (!name) {
        say("Saisissez un nom pour le document.", true);
        return;
      }
      if (name === d.name) {
        setRow(null);
        return;
      }
      setSaving(true);
      const res = await callApi(`${base}/${d.id}`, { method: "PATCH", body: { name } });
      setSaving(false);
      if (!res.ok) {
        say(res.error, true);
        return;
      }
      setRow(null);
      say("Document renommé");
      router.refresh();
    },
    startMove: (d) => startOn(d, "move", "déplacé"),
    move(d, folderId) {
      setRow(null);
      void moveDoc(d, folderId);
    },
    askDelete: (d) => startOn(d, "confirm", "supprimé"),
    async remove(d) {
      setWorking(d.id);
      const res = await callApi(`${base}/${d.id}`, { method: "DELETE" });
      setWorking(null);
      setRow(null);
      if (!res.ok) say(res.error, true);
      else say("Document supprimé");
      router.refresh();
    },
    async toggleLock(d) {
      setMessage(null);
      setWorking(d.id);
      const res = await callApi(`${base}/${d.id}/lock`, { body: { locked: !d.locked } });
      setWorking(null);
      if (!res.ok) say(res.error, true);
      else say(d.locked ? "Document déverrouillé" : "Document verrouillé");
      router.refresh();
    },
    cancel: () => setRow(null),
    // Mise à jour différée : modifier l'affichage pendant le démarrage du
    // glisser peut l'annuler dans certains navigateurs.
    dragStart: (d) => setTimeout(() => setDragDocId(d.id), 0),
    dragEnd() {
      setDragDocId(null);
      setOverKey(null);
    },
  };

  // --- Dossiers de rangement -------------------------------------------------

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function pickFilesFor(folderId: string | null) {
    uploadTarget.current = folderId;
    inputRef.current?.click();
  }

  async function createFolder(value: string) {
    const name = value.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    setFolderBusy(true);
    const res = await callApi(foldersBase, { body: { name } });
    setFolderBusy(false);
    if (!res.ok) {
      say(res.error, true);
      return;
    }
    setCreatingFolder(false);
    say("Dossier créé");
    router.refresh();
  }

  const folderActions: FolderActions = {
    addFiles: pickFilesFor,
    startRename(f) {
      setMessage(null);
      setFolderRow({ id: f.id, mode: "rename" });
    },
    async rename(f, value) {
      const name = value.trim();
      if (!name || name === f.name) {
        setFolderRow(null);
        return;
      }
      setFolderBusy(true);
      const res = await callApi(`${foldersBase}/${f.id}`, { method: "PATCH", body: { name } });
      setFolderBusy(false);
      if (!res.ok) {
        say(res.error, true);
        return;
      }
      setFolderRow(null);
      say("Dossier renommé");
      router.refresh();
    },
    askDelete(f) {
      setMessage(null);
      setFolderRow({ id: f.id, mode: "confirm" });
    },
    async remove(f) {
      setFolderBusy(true);
      const res = await callApi(`${foldersBase}/${f.id}`, { method: "DELETE" });
      setFolderBusy(false);
      setFolderRow(null);
      if (!res.ok) say(res.error, true);
      else say("Dossier supprimé");
      router.refresh();
    },
    cancel: () => setFolderRow(null),
  };

  // Zone de dépôt d'une section : accepte un document de cette page (déplacer)
  // ou des fichiers de l'ordinateur (envoyer directement dans ce dossier).
  function dropProps(key: string, folderId: string | null) {
    return {
      onDragOver: (e: React.DragEvent) => {
        const isDoc = hasType(e, DOC_DRAG_TYPE);
        if (!isDoc && !hasType(e, "Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = isDoc ? "move" : "copy";
        if (overKey !== key) setOverKey(key);
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOverKey(null);
        }
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setOverKey(null);
        const docId = e.dataTransfer.getData(DOC_DRAG_TYPE);
        const d = docId ? docs.find((x) => x.id === docId) : undefined;
        if (docId) {
          setDragDocId(null);
          if (d) void moveDoc(d, folderId);
        } else if (hasType(e, "Files")) {
          void uploadFiles(Array.from(e.dataTransfer.files), folderId);
        }
      },
    };
  }

  function renderSection(key: string, folder: FolderItem | null) {
    const list = byKey.get(key) ?? [];
    return (
      <FolderSection
        key={key}
        folder={folder}
        count={list.length}
        collapsed={collapsed.has(key)}
        onToggle={() => toggleCollapsed(key)}
        over={overKey === key}
        dropProps={dropProps(key, folder?.id ?? null)}
        mode={folder && folderRow?.id === folder.id ? folderRow.mode : "view"}
        busy={folderBusy}
        isOwner={isOwner}
        actions={folderActions}
      >
        {list.map((d) => (
          <DocumentRow
            key={d.id}
            doc={d}
            folders={folders}
            isOwner={isOwner}
            mode={row?.id === d.id ? row.mode : "view"}
            busy={working === d.id}
            saving={saving}
            dragging={dragDocId === d.id}
            actions={rowActions}
          />
        ))}
      </FolderSection>
    );
  }

  const unfiledCount = byKey.get(NO_FOLDER)?.length ?? 0;
  // « Sans dossier » : visible s'il contient des documents, pendant un glisser
  // (pour pouvoir y ramener un document) ou s'il n'y a aucun dossier.
  const showUnfiled =
    unfiledCount > 0 || dragDocId !== null || folders.length === 0;

  return (
    <div ref={rootRef} className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(Array.from(e.dataTransfer.files), null);
        }}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-6 text-center text-sm text-muted-foreground transition-colors",
          dragOver && "border-primary bg-accent",
        )}
      >
        {uploading ? (
          <p className="flex items-center gap-2" role="status">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Envoi de {uploading}
          </p>
        ) : (
          <>
            <Upload className="size-5" aria-hidden />
            <p>Glissez des PDF ici</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pickFilesFor(null)}
            >
              Choisir des fichiers
            </Button>
            <p className="text-xs">
              PDF uniquement, 10 Mo maximum. Ajoutés sans dossier : pour les
              ranger tout de suite, déposez-les sur un dossier ci-dessous.
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) =>
            void uploadFiles(Array.from(e.target.files ?? []), uploadTarget.current)
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusMessage message={message} className="flex-1" />
        {docs.length > 0 && <CaseCopyButton caseId={caseId} onMessage={say} />}
        {docs.length > 0 && <DownloadArchiveButton caseId={caseId} onMessage={say} />}
        {creatingFolder ? (
          <input
            autoFocus
            maxLength={80}
            placeholder="Nom du dossier"
            aria-label="Nom du nouveau dossier"
            disabled={folderBusy}
            onKeyDown={(e) => {
              if (e.key === "Escape") setCreatingFolder(false);
              if (e.key === "Enter") void createFolder(e.currentTarget.value);
            }}
            onBlur={(e) => {
              if (!folderBusy && e.currentTarget.value.trim() === "") {
                setCreatingFolder(false);
              }
            }}
            className="h-8 w-56 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMessage(null);
              setCreatingFolder(true);
            }}
          >
            <FolderPlus /> Nouveau dossier
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {folders.map((f) => renderSection(f.id, f))}
        {showUnfiled && renderSection(NO_FOLDER, null)}
      </div>
    </div>
  );
}
