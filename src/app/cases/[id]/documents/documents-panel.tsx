"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  FolderInput,
  FolderPlus,
  GripVertical,
  Loader2,
  Lock,
  LockOpen,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { DOCUMENTS_BUCKET, MAX_DOCUMENT_BYTES } from "@/lib/documents";
import { useDragAutoScroll } from "@/lib/drag-autoscroll";
import { cn } from "@/lib/utils";

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

// Clé des sections : l'identifiant du dossier, ou NO_FOLDER (« Sans dossier »)
const NO_FOLDER = "none";
// Type propre au glisser-déposer d'un document de cette page
const DOC_DRAG_TYPE = "application/x-studyflow-doc";

function hasType(e: React.DragEvent, type: string) {
  return Array.from(e.dataTransfer.types).includes(type);
}

type Message = { text: string; error: boolean };

async function call(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => null);
  return {
    ok: res.ok,
    data,
    error: res.ok ? null : ((data?.error as string) ?? `Erreur ${res.status}`),
  };
}

const JSON_HEADERS = { "Content-Type": "application/json" };

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
  const foldersBase = `/api/cases/${caseId}/folders`;
  const inputRef = useRef<HTMLInputElement>(null);
  // La page défile quand on glisse près du haut ou du bas du contenu
  const rootRef = useRef<HTMLDivElement>(null);
  useDragAutoScroll(rootRef);
  // Dossier qui recevra les fichiers choisis avec le sélecteur de fichiers
  const uploadTarget = useRef<string | null>(null);

  const [message, setMessage] = useState<Message | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Dossiers de rangement
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragDocId, setDragDocId] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [confirmFolderId, setConfirmFolderId] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);

  const say = (text: string, error = false) => setMessage({ text, error });

  async function uploadFiles(files: File[], folderId: string | null = null) {
    if (files.length === 0) return;
    setMessage(null);
    let added = 0;
    let lastError: string | null = null;

    for (const file of files) {
      if (!/\.pdf$/i.test(file.name)) {
        lastError = `${file.name} : seuls les fichiers PDF sont acceptés`;
        continue;
      }
      if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) {
        lastError = `${file.name} : le fichier doit faire 10 Mo au maximum`;
        continue;
      }
      setUploading(file.name);
      const name =
        file.name.replace(/\.pdf$/i, "").trim().slice(0, 120) || "Document";

      // 1. Le serveur contrôle la demande et renvoie une URL signée
      const step1 = await call(`${base}/upload-url`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          name,
          originalFileName: file.name,
          sizeBytes: file.size,
        }),
      });
      if (!step1.ok) {
        lastError = `${file.name} : ${step1.error}`;
        continue;
      }

      // 2. Le navigateur envoie le PDF directement au stockage
      const { error: uploadError } = await createClient()
        .storage.from(DOCUMENTS_BUCKET)
        .uploadToSignedUrl(step1.data.path, step1.data.token, file, {
          contentType: "application/pdf",
        });
      if (uploadError) {
        lastError = `${file.name} : l'envoi a échoué, réessayez`;
        continue;
      }

      // 3. Le serveur vérifie le fichier reçu et crée le document
      const step3 = await call(base, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          documentId: step1.data.documentId,
          name,
          originalFileName: file.name,
          folderId,
        }),
      });
      if (!step3.ok) {
        lastError = `${file.name} : ${step3.error}`;
        continue;
      }
      added += 1;
    }

    setUploading(null);
    if (lastError) say(lastError, true);
    else say(added > 1 ? `${added} documents ajoutés` : "Document ajouté");
    if (added > 0) router.refresh();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function open(id: string) {
    setMessage(null);
    // Fenêtre ouverte tout de suite (clic de l'utilisateur) pour éviter le
    // blocage des fenêtres, puis dirigée vers le lien signé d'une minute.
    const win = window.open("about:blank", "_blank");
    const res = await call(`${base}/${id}/open`, { method: "POST" });
    if (!res.ok || typeof res.data?.url !== "string") {
      win?.close();
      say(res.error ?? "Impossible d'ouvrir le document", true);
      return;
    }
    if (!win) {
      say("Le navigateur a bloqué l'ouverture. Autorisez les fenêtres pour ce site.", true);
      return;
    }
    win.opener = null;
    win.location.href = res.data.url;
  }

  function startRename(d: DocItem) {
    if (d.locked) {
      say("Ce document est verrouillé par le patron : il ne peut plus être renommé.", true);
      return;
    }
    setMessage(null);
    setConfirmId(null);
    setEditingId(d.id);
  }

  async function rename(d: DocItem, value: string) {
    const name = value.trim();
    if (!name) {
      say("Saisissez un nom pour le document.", true);
      return;
    }
    if (name === d.name) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    const res = await call(`${base}/${d.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      say(res.error ?? "Erreur", true);
      return;
    }
    setEditingId(null);
    say("Document renommé");
    router.refresh();
  }

  function askDelete(d: DocItem) {
    if (d.locked) {
      say("Ce document est verrouillé par le patron : il ne peut plus être supprimé.", true);
      return;
    }
    setMessage(null);
    setEditingId(null);
    setConfirmId(d.id);
  }

  async function remove(id: string) {
    setWorking(id);
    const res = await call(`${base}/${id}`, { method: "DELETE" });
    setWorking(null);
    setConfirmId(null);
    if (!res.ok) say(res.error ?? "Erreur", true);
    else say("Document supprimé");
    router.refresh();
  }

  async function toggleLock(d: DocItem) {
    setMessage(null);
    setWorking(d.id);
    const res = await call(`${base}/${d.id}/lock`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ locked: !d.locked }),
    });
    setWorking(null);
    if (!res.ok) say(res.error ?? "Erreur", true);
    else say(d.locked ? "Document déverrouillé" : "Document verrouillé");
    router.refresh();
  }

  // --- Dossiers de rangement -------------------------------------------------

  const folderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders]);

  // Documents par section (un document dont le dossier est inconnu va dans « Sans dossier »)
  const byKey = useMemo(() => {
    const map = new Map<string, DocItem[]>();
    for (const d of docs) {
      const key = d.folderId && folderIds.has(d.folderId) ? d.folderId : NO_FOLDER;
      map.set(key, [...(map.get(key) ?? []), d]);
    }
    return map;
  }, [docs, folderIds]);

  function toggleCollapsed(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function moveDoc(docId: string, folderId: string | null) {
    const d = docs.find((x) => x.id === docId);
    if (!d) return;
    const current = d.folderId && folderIds.has(d.folderId) ? d.folderId : null;
    if (current === folderId) return;
    if (d.locked) {
      say("Ce document est verrouillé par le patron : il ne peut plus être déplacé.", true);
      return;
    }
    setMessage(null);
    setWorking(docId);
    const res = await call(`${base}/${docId}/move`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ folderId }),
    });
    setWorking(null);
    if (!res.ok) {
      say(res.error ?? "Erreur", true);
    } else {
      const target = folders.find((f) => f.id === folderId);
      say(
        target
          ? `Document déplacé dans « ${target.name} »`
          : "Document retiré de son dossier",
      );
    }
    router.refresh();
  }

  async function createFolder(value: string) {
    const name = value.trim();
    if (!name) {
      setCreatingFolder(false);
      return;
    }
    setFolderBusy(true);
    const res = await call(foldersBase, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name }),
    });
    setFolderBusy(false);
    if (!res.ok) {
      say(res.error ?? "Erreur", true);
      return;
    }
    setCreatingFolder(false);
    say("Dossier créé");
    router.refresh();
  }

  async function renameFolder(f: FolderItem, value: string) {
    const name = value.trim();
    if (!name || name === f.name) {
      setEditingFolderId(null);
      return;
    }
    setFolderBusy(true);
    const res = await call(`${foldersBase}/${f.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ name }),
    });
    setFolderBusy(false);
    if (!res.ok) {
      say(res.error ?? "Erreur", true);
      return;
    }
    setEditingFolderId(null);
    say("Dossier renommé");
    router.refresh();
  }

  async function removeFolder(f: FolderItem) {
    setFolderBusy(true);
    const res = await call(`${foldersBase}/${f.id}`, { method: "DELETE" });
    setFolderBusy(false);
    setConfirmFolderId(null);
    if (!res.ok) say(res.error ?? "Erreur", true);
    else say("Dossier supprimé");
    router.refresh();
  }

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
        if (docId) {
          setDragDocId(null);
          void moveDoc(docId, folderId);
        } else if (hasType(e, "Files")) {
          void uploadFiles(Array.from(e.dataTransfer.files), folderId);
        }
      },
    };
  }

  function pickFilesFor(folderId: string | null) {
    uploadTarget.current = folderId;
    inputRef.current?.click();
  }

  function renderRow(d: DocItem) {
    const draggable = !d.locked && editingId !== d.id && movingId !== d.id;
    return (
      <li
        key={d.id}
        draggable={draggable}
        onDragStart={(e) => {
          e.dataTransfer.setData(DOC_DRAG_TYPE, d.id);
          e.dataTransfer.effectAllowed = "move";
          // Mise à jour différée : modifier l'affichage pendant le démarrage
          // du glisser peut l'annuler dans certains navigateurs.
          setTimeout(() => setDragDocId(d.id), 0);
        }}
        onDragEnd={() => {
          setDragDocId(null);
          setOverKey(null);
        }}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 text-sm",
          dragDocId === d.id && "opacity-50",
        )}
      >
        {draggable ? (
          <GripVertical
            className="-ml-1 size-4 shrink-0 cursor-grab text-muted-foreground"
            aria-hidden
          />
        ) : (
          <span className="-ml-1 size-4 shrink-0" aria-hidden />
        )}
        <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />

        {editingId === d.id ? (
          <input
            autoFocus
            defaultValue={d.name}
            maxLength={120}
            aria-label="Nom du document"
            disabled={saving}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditingId(null);
              if (e.key === "Enter") void rename(d, e.currentTarget.value);
            }}
            onBlur={() => {
              if (!saving) setEditingId(null);
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        ) : (
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2">
              <span className="truncate font-medium">{d.name}</span>
              {d.locked && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                  <Lock className="size-3" aria-hidden /> Verrouillé
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {d.sizeLabel} · ajouté par {d.uploadedBy}, le {d.dateLabel}
            </p>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1">
          {movingId === d.id ? (
            <select
              autoFocus
              aria-label={`Déplacer ${d.name} vers`}
              defaultValue={d.folderId ?? NO_FOLDER}
              onChange={(e) => {
                const value = e.target.value;
                setMovingId(null);
                void moveDoc(d.id, value === NO_FOLDER ? null : value);
              }}
              onBlur={() => setMovingId(null)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setMovingId(null);
              }}
              className="h-8 max-w-48 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value={NO_FOLDER}>Sans dossier</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          ) : confirmId === d.id ? (
            <>
              <span className="mr-1 text-xs">Supprimer ce document ?</span>
              <Button
                variant="destructive"
                size="xs"
                disabled={working === d.id}
                onClick={() => void remove(d.id)}
              >
                Supprimer
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setConfirmId(null)}>
                Annuler
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void open(d.id)}
                aria-label={`Ouvrir ${d.name}`}
                title="Ouvrir dans un nouvel onglet"
              >
                <Eye />
              </Button>
              {folders.length > 0 && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={working === d.id}
                  onClick={() => {
                    if (d.locked) {
                      say(
                        "Ce document est verrouillé par le patron : il ne peut plus être déplacé.",
                        true,
                      );
                      return;
                    }
                    setMessage(null);
                    setEditingId(null);
                    setConfirmId(null);
                    setMovingId(d.id);
                  }}
                  aria-label={`Déplacer ${d.name}`}
                  title="Déplacer vers un dossier (ou glissez le document)"
                >
                  <FolderInput />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => startRename(d)}
                aria-label={`Renommer ${d.name}`}
                title="Renommer"
              >
                <Pencil />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => askDelete(d)}
                aria-label={`Supprimer ${d.name}`}
                title="Supprimer"
              >
                <Trash2 />
              </Button>
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={working === d.id}
                  onClick={() => void toggleLock(d)}
                  aria-label={
                    d.locked ? `Déverrouiller ${d.name}` : `Verrouiller ${d.name}`
                  }
                  title={d.locked ? "Déverrouiller" : "Verrouiller"}
                >
                  {d.locked ? <LockOpen /> : <Lock />}
                </Button>
              )}
            </>
          )}
        </div>
      </li>
    );
  }

  function renderSection(key: string, folder: FolderItem | null) {
    const list = byKey.get(key) ?? [];
    const isCollapsed = collapsed.has(key);
    const title = folder?.name ?? "Sans dossier";
    const isOver = overKey === key;
    const editing = folder !== null && editingFolderId === folder.id;
    const confirming = folder !== null && confirmFolderId === folder.id;

    return (
      <section
        key={key}
        aria-label={title}
        {...dropProps(key, folder?.id ?? null)}
        className={cn(
          "rounded-xl border transition-colors",
          isOver && "border-primary bg-accent/40",
        )}
      >
        <header className="flex items-center gap-2 px-3 py-2">
          <button
            type="button"
            onClick={() => toggleCollapsed(key)}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? `Déplier ${title}` : `Replier ${title}`}
            className="shrink-0 rounded text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? (
              <ChevronRight className="size-4" aria-hidden />
            ) : (
              <ChevronDown className="size-4" aria-hidden />
            )}
          </button>
          <Folder className="size-5 shrink-0 text-muted-foreground" aria-hidden />

          {editing && folder ? (
            <input
              autoFocus
              defaultValue={folder.name}
              maxLength={80}
              aria-label="Nom du dossier"
              disabled={folderBusy}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditingFolderId(null);
                if (e.key === "Enter") {
                  void renameFolder(folder, e.currentTarget.value);
                }
              }}
              onBlur={() => {
                if (!folderBusy) setEditingFolderId(null);
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          ) : (
            <h3 className="min-w-0 flex-1 truncate text-sm font-medium">
              {title}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {list.length}
              </span>
            </h3>
          )}

          <div className="flex shrink-0 items-center gap-1">
            {confirming && folder ? (
              <>
                <span className="mr-1 text-xs">
                  {list.length > 0
                    ? `Supprimer ce dossier ? Ses ${list.length} document${list.length > 1 ? "s" : ""} iront dans « Sans dossier ».`
                    : "Supprimer ce dossier ?"}
                </span>
                <Button
                  variant="destructive"
                  size="xs"
                  disabled={folderBusy}
                  onClick={() => void removeFolder(folder)}
                >
                  Supprimer
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setConfirmFolderId(null)}
                >
                  Annuler
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => pickFilesFor(folder?.id ?? null)}
                  aria-label={`Ajouter des PDF dans ${title}`}
                  title="Ajouter des PDF dans ce dossier"
                >
                  <Plus />
                </Button>
                {folder && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setMessage(null);
                      setConfirmFolderId(null);
                      setEditingFolderId(folder.id);
                    }}
                    aria-label={`Renommer le dossier ${folder.name}`}
                    title="Renommer le dossier"
                  >
                    <Pencil />
                  </Button>
                )}
                {folder && isOwner && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setMessage(null);
                      setEditingFolderId(null);
                      setConfirmFolderId(folder.id);
                    }}
                    aria-label={`Supprimer le dossier ${folder.name}`}
                    title="Supprimer le dossier (patron)"
                  >
                    <Trash2 />
                  </Button>
                )}
              </>
            )}
          </div>
        </header>

        {!isCollapsed &&
          (list.length === 0 ? (
            <p className="border-t px-3 py-3 text-xs text-muted-foreground">
              {key === NO_FOLDER
                ? "Déposez ici un document pour le sortir de son dossier."
                : "Dossier vide : déposez des PDF ici."}
            </p>
          ) : (
            <ul className="divide-y border-t">{list.map(renderRow)}</ul>
          ))}
      </section>
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

      <div className="flex items-center justify-between gap-3">
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "min-h-5 flex-1 px-1 text-sm",
            message?.error ? "text-red-600" : "text-muted-foreground",
          )}
        >
          {message?.text}
        </p>
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
