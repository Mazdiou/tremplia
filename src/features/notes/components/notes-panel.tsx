"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_NOTE_LENGTH } from "@/features/notes/schemas";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export type NoteItem = {
  id: string;
  authorName: string;
  content: string;
  dateLabel: string;
  editedLabel: string | null;
  canManage: boolean;
};

type Message = { text: string; error: boolean };


const TEXTAREA =
  "w-full min-h-24 resize-y rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60";

export function NotesPanel({
  caseId,
  notes,
  truncated,
}: {
  caseId: string;
  notes: NoteItem[];
  truncated: boolean;
}) {
  const router = useRouter();
  const base = `/api/cases/${caseId}/notes`;

  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);

  const say = (text: string, error = false) => setMessage({ text, error });

  async function addNote() {
    const content = draft.trim();
    if (!content) {
      say("Écrivez votre note.", true);
      return;
    }
    setMessage(null);
    setAdding(true);
    const res = await callApi(base, { body: { content } });
    setAdding(false);
    if (!res.ok) {
      say(res.error, true);
      return;
    }
    setDraft("");
    say("Note ajoutée");
    router.refresh();
  }

  async function saveEdit(note: NoteItem) {
    const content = editDraft.trim();
    if (!content) {
      say("Écrivez votre note.", true);
      return;
    }
    if (content === note.content) {
      setEditingId(null);
      return;
    }
    setMessage(null);
    setSaving(true);
    const res = await callApi(`${base}/${note.id}`, { method: "PATCH", body: { content } });
    setSaving(false);
    if (!res.ok) {
      say(res.error, true);
      return;
    }
    setEditingId(null);
    say("Note modifiée");
    router.refresh();
  }

  async function removeNote(id: string) {
    setMessage(null);
    setDeleting(id);
    const res = await callApi(`${base}/${id}`, { method: "DELETE" });
    setDeleting(null);
    setConfirmId(null);
    if (!res.ok) say(res.error, true);
    else say("Note supprimée");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="new-note" className="text-sm font-medium">
          Nouvelle note
        </label>
        <textarea
          id="new-note"
          value={draft}
          maxLength={MAX_NOTE_LENGTH}
          disabled={adding}
          placeholder="Écrivez une note sur cette candidature. Elle sera visible par toute l'agence."
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void addNote();
            }
          }}
          className={TEXTAREA}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">
            {draft.length} / {MAX_NOTE_LENGTH} · Ctrl + Entrée pour ajouter
          </span>
          <Button
            size="sm"
            disabled={adding || draft.trim() === ""}
            onClick={() => void addNote()}
          >
            {adding && <Loader2 className="animate-spin" aria-hidden />}
            Ajouter la note
          </Button>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={cn(
          "min-h-5 px-1 text-sm",
          message?.error ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {message?.text}
      </p>

      {notes.length === 0 ? (
        <div className="rounded-xl border px-6 py-10 text-center">
          <StickyNote
            className="mx-auto size-8 text-muted-foreground"
            aria-hidden
          />
          <p className="mt-3 text-sm font-medium">Aucune note pour ce dossier</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Les notes aident toute l&apos;équipe à suivre cette candidature.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border bg-card px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{n.authorName}</p>
                  <p className="text-xs text-muted-foreground">
                    {n.dateLabel}
                    {n.editedLabel && ` · ${n.editedLabel}`}
                  </p>
                </div>

                {n.canManage && editingId !== n.id && (
                  <div className="flex shrink-0 items-center gap-1">
                    {confirmId === n.id ? (
                      <>
                        <span className="mr-1 text-xs">Supprimer cette note ?</span>
                        <Button
                          variant="destructive"
                          size="xs"
                          disabled={deleting === n.id}
                          onClick={() => void removeNote(n.id)}
                        >
                          Supprimer
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setConfirmId(null)}
                        >
                          Annuler
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setMessage(null);
                            setConfirmId(null);
                            setEditDraft(n.content);
                            setEditingId(n.id);
                          }}
                          aria-label={`Modifier la note de ${n.authorName}`}
                          title="Modifier"
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setMessage(null);
                            setEditingId(null);
                            setConfirmId(n.id);
                          }}
                          aria-label={`Supprimer la note de ${n.authorName}`}
                          title="Supprimer"
                        >
                          <Trash2 />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {editingId === n.id ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    autoFocus
                    value={editDraft}
                    maxLength={MAX_NOTE_LENGTH}
                    disabled={saving}
                    aria-label="Modifier la note"
                    onChange={(e) => setEditDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditingId(null);
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        void saveEdit(n);
                      }
                    }}
                    className={TEXTAREA}
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => setEditingId(null)}
                    >
                      Annuler
                    </Button>
                    <Button
                      size="sm"
                      disabled={saving || editDraft.trim() === ""}
                      onClick={() => void saveEdit(n)}
                    >
                      {saving && <Loader2 className="animate-spin" aria-hidden />}
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 whitespace-pre-wrap break-words">{n.content}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {truncated && (
        <p className="px-1 text-xs text-muted-foreground">
          Seules les {notes.length} notes les plus récentes sont affichées.
        </p>
      )}
    </div>
  );
}
