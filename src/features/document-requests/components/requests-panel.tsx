"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleCheck,
  Eye,
  FileText,
  Hourglass,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  StatusMessage,
  StatusPill,
  type ActionMessage,
  type PillTone,
} from "@/components/page-ui";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { openDocument } from "@/features/documents/open-document";
import type { FolderItem } from "@/features/documents/components/documents-panel";
import { MAX_REQUESTS_PER_CASE } from "../schemas";
import type { RequestItem, RequestStatus } from "../types";

// Pièces que l'agence demande au candidat, en tête de l'onglet Documents.
// Le candidat les envoie depuis son espace ; le document reçu rejoint les
// documents du dossier, dans le dossier de rangement choisi ici.

// Pièces courantes, proposées en un clic (celles déjà demandées sont masquées)
const SUGGESTIONS = [
  "Passeport",
  "Photo d'identité",
  "Acte de naissance",
  "Relevés de notes",
  "Diplôme du baccalauréat",
  "Certificat de scolarité",
];

const STATUS: Record<RequestStatus, { label: string; tone: PillTone }> = {
  pending: { label: "En attente", tone: "off" },
  received: { label: "À vérifier", tone: "warn" },
  accepted: { label: "Acceptée", tone: "ok" },
};

const NO_FOLDER = "none";

const fieldClass =
  "h-8 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

type RowMode = "edit" | "confirm";

export function RequestsPanel({
  caseId,
  requests,
  folders,
  accessNote,
  readOnly,
}: {
  caseId: string;
  requests: RequestItem[];
  folders: FolderItem[];
  // Pourquoi le candidat ne voit pas encore ces pièces (accès fermé…), sinon null
  accessNote: string | null;
  // Abonnement expiré : consultation seulement
  readOnly: boolean;
}) {
  const router = useRouter();
  const base = `/api/cases/${caseId}/document-requests`;
  const [message, setMessage] = useState<ActionMessage>(null);
  const [adding, setAdding] = useState(false);
  const [row, setRow] = useState<{ id: string; mode: RowMode } | null>(null);
  // Action en cours : « new », ou l'identifiant de la pièce
  const [busy, setBusy] = useState<string | null>(null);

  const say = (text: string, error = false) => setMessage({ text, error });
  const folderName = (id: string | null) => folders.find((f) => f.id === id)?.name ?? null;

  if (readOnly && requests.length === 0) return null;

  const received = requests.filter((r) => r.status !== "pending").length;
  const full = requests.length >= MAX_REQUESTS_PER_CASE;
  const taken = new Set(requests.map((r) => r.label.toLowerCase()));
  const suggestions = SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()));

  // Renvoie vrai si la pièce est enregistrée
  async function create(label: string, folderId: string | null) {
    setBusy("new");
    setMessage(null);
    const res = await callApi(base, { body: { label, folderId } });
    setBusy(null);
    if (!res.ok) {
      say(res.error, true);
      return false;
    }
    say(`« ${label} » demandée au candidat`);
    router.refresh();
    return true;
  }

  async function update(r: RequestItem, label: string, folderId: string | null) {
    setBusy(r.id);
    setMessage(null);
    const res = await callApi(`${base}/${r.id}`, { method: "PATCH", body: { label, folderId } });
    setBusy(null);
    if (!res.ok) {
      say(res.error, true);
      return false;
    }
    setRow(null);
    say("Pièce modifiée");
    router.refresh();
    return true;
  }

  async function remove(r: RequestItem) {
    setBusy(r.id);
    setMessage(null);
    const res = await callApi(`${base}/${r.id}`, { method: "DELETE" });
    setBusy(null);
    setRow(null);
    if (!res.ok) say(res.error, true);
    else say(`« ${r.label} » n'est plus demandée`);
    router.refresh();
  }

  async function setAccepted(r: RequestItem, accepted: boolean) {
    if (!r.document) return;
    setBusy(r.id);
    setMessage(null);
    const res = await callApi(`${base}/${r.id}/accept`, {
      method: "PUT",
      body: { accepted, documentId: r.document.id },
    });
    setBusy(null);
    if (!res.ok) say(res.error, true);
    else
      say(
        accepted
          ? `« ${r.label} » acceptée : le candidat ne peut plus la changer`
          : `« ${r.label} » n'est plus acceptée : le candidat peut la remplacer`,
      );
    router.refresh();
  }

  async function open(r: RequestItem) {
    if (!r.document) return;
    setMessage(null);
    const error = await openDocument(caseId, r.document.id);
    if (error) say(error, true);
  }

  return (
    <section aria-labelledby="requests-title" className="rounded-xl border">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
        {/* Peu de place : le bouton passe sous le titre */}
        <h2 id="requests-title" className="min-w-48 flex-1 text-sm font-medium">
          Pièces demandées au candidat
          {requests.length > 0 && (
            <span className="ml-2 inline-block text-xs font-normal whitespace-nowrap text-muted-foreground">
              {received} reçue{received > 1 ? "s" : ""} sur {requests.length}
            </span>
          )}
        </h2>
        {!readOnly && !adding && !full && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setMessage(null);
              setRow(null);
              setAdding(true);
            }}
          >
            <Plus /> Demander une pièce
          </Button>
        )}
      </header>

      {requests.length === 0 && !adding && (
        <p className="border-t px-3 py-3 text-xs text-muted-foreground">
          Listez les pièces que le candidat doit vous envoyer (passeport, relevés de notes…). Il
          les envoie depuis son espace, en PDF ou en photos, et ne peut envoyer que celles-ci.
        </p>
      )}

      {accessNote && (requests.length > 0 || adding) && (
        <p className="border-t bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {accessNote}
        </p>
      )}

      {adding && (
        <div className="border-t px-3 py-3">
          <RequestForm
            folders={folders}
            busy={busy === "new"}
            submitLabel="Demander"
            suggestions={suggestions}
            // Le formulaire reste ouvert pour demander la pièce suivante
            onSubmit={create}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}

      {requests.length > 0 && (
        <ul className="divide-y border-t">
          {requests.map((r) => {
            const mode = row?.id === r.id ? row.mode : "view";
            const status = STATUS[r.status];
            const rowBusy = busy === r.id;
            if (mode === "edit") {
              return (
                <li key={r.id} className="px-3 py-3">
                  <RequestForm
                    initial={r}
                    folders={folders}
                    busy={rowBusy}
                    submitLabel="Enregistrer"
                    onSubmit={(label, folderId) => update(r, label, folderId)}
                    onCancel={() => setRow(null)}
                  />
                </li>
              );
            }
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 px-3 py-2.5 text-sm @max-xl:flex-wrap"
              >
                {r.status === "pending" ? (
                  <Hourglass className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                ) : r.status === "received" ? (
                  <FileText className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                ) : (
                  <CircleCheck className="size-5 shrink-0 text-success" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="truncate font-medium">{r.label}</span>
                    <StatusPill tone={status.tone}>{status.label}</StatusPill>
                    {r.document?.locked && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="size-3" aria-hidden /> Verrouillé
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.document
                      ? `Reçue le ${r.document.dateLabel} : ${r.document.fileName} (${r.document.sizeLabel})`
                      : folderName(r.folderId)
                        ? `Sera rangée dans « ${folderName(r.folderId)} »`
                        : "Sera rangée sans dossier"}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1 @max-xl:-mt-1 @max-xl:w-full @max-xl:justify-end">
                  {mode === "confirm" ? (
                    <>
                      <span className="mr-1 text-xs">
                        {r.document
                          ? "Ne plus demander cette pièce ? Le document reçu reste dans le dossier."
                          : "Ne plus demander cette pièce ?"}
                      </span>
                      <Button
                        variant="destructive"
                        size="xs"
                        disabled={rowBusy}
                        onClick={() => void remove(r)}
                      >
                        Ne plus demander
                      </Button>
                      <Button variant="ghost" size="xs" onClick={() => setRow(null)}>
                        Annuler
                      </Button>
                    </>
                  ) : (
                    <>
                      {r.document && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => void open(r)}
                          aria-label={`Ouvrir ${r.label}`}
                          title="Ouvrir dans un nouvel onglet"
                        >
                          <Eye />
                        </Button>
                      )}
                      {!readOnly && r.status === "received" && (
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={rowBusy}
                          onClick={() => void setAccepted(r, true)}
                          title="Le candidat ne pourra plus remplacer ni retirer cette pièce"
                        >
                          <Check /> Accepter
                        </Button>
                      )}
                      {!readOnly && r.status === "accepted" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={rowBusy}
                          onClick={() => void setAccepted(r, false)}
                          aria-label={`Ne plus accepter ${r.label}`}
                          title="Ne plus accepter : le candidat pourra la remplacer"
                        >
                          <Undo2 />
                        </Button>
                      )}
                      {!readOnly && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setMessage(null);
                              setAdding(false);
                              setRow({ id: r.id, mode: "edit" });
                            }}
                            aria-label={`Modifier ${r.label}`}
                            title="Renommer ou changer le dossier de rangement"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setMessage(null);
                              setRow({ id: r.id, mode: "confirm" });
                            }}
                            aria-label={`Ne plus demander ${r.label}`}
                            title="Ne plus demander cette pièce"
                          >
                            <Trash2 />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {message && (
        <div className="border-t px-3 py-2">
          <StatusMessage message={message} />
        </div>
      )}
    </section>
  );
}

// Nom de la pièce et dossier de rangement du document à recevoir
function RequestForm({
  initial,
  folders,
  busy,
  submitLabel,
  suggestions = [],
  onSubmit,
  onCancel,
}: {
  initial?: RequestItem;
  folders: FolderItem[];
  busy: boolean;
  submitLabel: string;
  suggestions?: string[];
  // Renvoie vrai si c'est enregistré
  onSubmit: (label: string, folderId: string | null) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [folder, setFolder] = useState(initial?.folderId ?? NO_FOLDER);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const value = label.trim();
    if (!value || busy) return;
    const saved = await onSubmit(value, folder === NO_FOLDER ? null : folder);
    // Nouvelle pièce : le champ se vide pour la suivante
    if (saved && !initial) {
      setLabel("");
      inputRef.current?.focus();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
      className="space-y-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={80}
          placeholder="Nom de la pièce (ex. Passeport)"
          aria-label="Nom de la pièce"
          disabled={busy}
          className={cn(fieldClass, "min-w-48 flex-1")}
        />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">Ranger dans</span>
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            disabled={busy}
            className={cn(fieldClass, "max-w-48 text-foreground")}
          >
            <option value={NO_FOLDER}>Sans dossier</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <Button type="submit" size="sm" disabled={busy || label.trim() === ""}>
            {submitLabel}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {initial ? "Annuler" : "Fermer"}
          </Button>
        </div>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Suggestions :</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => {
                setLabel(s);
                inputRef.current?.focus();
              }}
              className="touch-target rounded-full border px-2.5 py-0.5 text-xs hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
