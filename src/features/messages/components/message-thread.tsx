"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessagesSquare, SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { MAX_MESSAGE_LENGTH, type MessageItem } from "@/features/messages/schemas";

export type ThreadMessage = MessageItem & { timeLabel: string };

// Nouveaux messages de l'autre côté : vérifiés régulièrement tant que la
// page est visible. Le candidat n'a pas de temps réel ; côté agence,
// LiveRefresh fait déjà le travail et ceci reste un filet de sécurité.
const REFRESH_MS = 15_000;

export function MessageThread({
  viewer,
  messages,
  unread,
  sendUrl,
  readUrl,
  studentName,
  agencyName,
  emptyHint,
  readOnlyNotice,
}: {
  viewer: "agency" | "student";
  messages: ThreadMessage[];
  // Messages de l'autre côté non lus : la conversation est marquée lue
  unread: number;
  sendUrl: string;
  readUrl: string;
  studentName: string;
  agencyName: string;
  emptyHint: string;
  // Abonnement de l'agence expiré : lecture seule, ce texte remplace la saisie
  readOnlyNotice?: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Conversation affichée = lue ; les pastilles se mettent à jour ensuite
  useEffect(() => {
    if (unread === 0) return;
    void callApi(readUrl).then((res) => res.ok && router.refresh());
  }, [unread, readUrl, router]);

  // Vérification légère : la page n'est relue que si un message est arrivé
  const lastId = messages.at(-1)?.id ?? null;
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const res = await callApi<{ last: string | null }>(sendUrl, { method: "GET" });
      if (res.ok && res.data.last !== lastId) router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router, sendUrl, lastId]);

  // Dernier message visible à l'ouverture et à chaque nouveau message
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body) return setError("Écrivez votre message.");
    setSending(true);
    setError(null);
    const res = await callApi(sendUrl, { body: { body } });
    setSending(false);
    if (!res.ok) return setError(res.error);
    setDraft("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <MessagesSquare className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 text-sm font-medium">Aucun message pour le moment</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyHint}</p>
        </div>
      ) : (
        <ol className="space-y-3" aria-label="Conversation">
          {messages.map((m) => {
            const mine = m.sender === viewer;
            const who =
              m.sender === "student"
                ? viewer === "student"
                  ? "Vous"
                  : studentName
                : viewer === "agency"
                  ? (m.authorName ?? agencyName)
                  : `${m.authorName ?? "Votre conseiller"} · ${agencyName}`;
            return (
              <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <span className="mb-1 px-1 text-xs text-muted-foreground">
                  {who} · {m.timeLabel}
                </span>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words sm:max-w-[75%]",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border bg-card",
                  )}
                >
                  {m.kind === "change_request" && (
                    <span
                      className={cn(
                        "mb-1 block text-xs font-semibold",
                        mine ? "text-primary-foreground/80" : "text-amber-700 dark:text-amber-300",
                      )}
                    >
                      Demande de modification
                    </span>
                  )}
                  {m.body}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {readOnlyNotice ? (
        <p className="sticky bottom-0 rounded-xl border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
          {readOnlyNotice}
        </p>
      ) : (
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="sticky bottom-0 space-y-2 border-t bg-background pt-3 pb-1"
      >
        <label htmlFor="message-draft" className="sr-only">
          Votre message
        </label>
        <textarea
          id="message-draft"
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          disabled={sending}
          rows={3}
          placeholder={
            viewer === "agency" ? "Écrire au candidat…" : `Écrire à ${agencyName}…`
          }
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void send();
            }
          }}
          className="w-full resize-y rounded-xl border border-input bg-card px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        />
        <div className="flex items-center justify-between gap-3">
          <p
            role="status"
            aria-live="polite"
            className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
          >
            {error ?? <span className="max-sm:hidden">Ctrl + Entrée pour envoyer</span>}
          </p>
          <Button type="submit" disabled={sending || draft.trim() === ""}>
            {sending ? <Loader2 className="animate-spin" aria-hidden /> : <SendHorizontal />}
            Envoyer
          </Button>
        </div>
      </form>
      )}
      {/* Après la zone de saisie : le défilement va jusqu'en bas de la page,
          le dernier message n'est jamais caché sous la saisie */}
      <div ref={endRef} />
    </div>
  );
}
