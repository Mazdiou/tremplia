"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, ClipboardCheck, Loader2, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { MAX_MESSAGE_LENGTH, type ReviewStatus } from "@/features/student/schemas";

// Demande de modification : un message à l'agence, obligatoire
function RequestDialog({
  open,
  agencyName,
  onClose,
}: {
  open: boolean;
  agencyName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function send() {
    if (message.trim() === "") return setError("Expliquez ce que vous souhaitez modifier.");
    setSending(true);
    setError(null);
    const res = await callApi("/api/student/review", {
      body: { decision: "changes_requested", message },
    });
    setSending(false);
    if (!res.ok) return setError(res.error);
    setMessage("");
    onClose();
    router.refresh();
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && !sending && onClose()}
      className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl border bg-card p-5 text-card-foreground backdrop:bg-black/45"
    >
      <h2 className="text-base font-semibold">Demander une modification</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Votre message est envoyé à {agencyName}. Précisez ce qu&apos;il faut changer dans la
        lettre ou dans les formations.
      </p>
      <label htmlFor="change-request" className="sr-only">
        Votre message
      </label>
      <textarea
        id="change-request"
        value={message}
        maxLength={MAX_MESSAGE_LENGTH}
        disabled={sending}
        onChange={(e) => {
          setMessage(e.target.value);
          setError(null);
        }}
        placeholder="Ex. : Pouvez-vous ajouter une formation à Lille et retirer celle de Nantes ?"
        className="mt-4 min-h-32 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {message.length} / {MAX_MESSAGE_LENGTH}
        </span>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={sending}>
          Annuler
        </Button>
        <Button onClick={() => void send()} disabled={sending}>
          {sending && <Loader2 className="animate-spin" aria-hidden />}
          Envoyer la demande
        </Button>
      </div>
    </dialog>
  );
}

// Bandeau de l'espace candidat : son avis sur la lettre et les formations
export function ReviewBanner({
  status,
  respondedLabel,
  lastRequest,
  agencyName,
}: {
  status: ReviewStatus;
  respondedLabel: string | null;
  lastRequest: string | null;
  agencyName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true);
    setError(null);
    const res = await callApi("/api/student/review", { body: { decision: "approved" } });
    setBusy(false);
    setConfirming(false);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  const tone = {
    pending: "border-primary/30 bg-primary/5",
    approved: "border-emerald-500/30 bg-emerald-500/5",
    changes_requested: "border-amber-500/30 bg-amber-500/5",
  }[status];

  return (
    <section aria-label="Votre avis" className={cn("rounded-xl border p-4", tone)}>
      {status === "pending" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Votre avis est attendu</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Relisez votre lettre de motivation et vos formations, puis donnez votre
                accord pour que {agencyName} continue votre candidature.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2 max-sm:flex-col">
            <Button onClick={() => setConfirming(true)} disabled={busy}>
              <CircleCheck /> Je valide
            </Button>
            <Button variant="outline" onClick={() => setRequesting(true)} disabled={busy}>
              Demander une modification
            </Button>
          </div>
        </div>
      )}

      {status === "approved" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <div>
              <p className="font-medium">Vous avez validé votre dossier</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {respondedLabel && `Le ${respondedLabel}. `}
                {agencyName} poursuit votre candidature.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="self-start sm:self-center"
            onClick={() => setRequesting(true)}>
            Demander une modification
          </Button>
        </div>
      )}

      {status === "changes_requested" && (
        <div className="flex gap-3">
          <MessageSquareText className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium">Demande de modification envoyée</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {respondedLabel && `Le ${respondedLabel}. `}
              {agencyName} va faire les corrections ; vous pourrez ensuite valider la
              nouvelle version.
            </p>
            {lastRequest && (
              <blockquote className="mt-2 border-l-2 border-amber-500/50 pl-3 text-sm whitespace-pre-wrap break-words">
                {lastRequest}
              </blockquote>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirming}
        title="Valider votre dossier ?"
        body={`Vous confirmez votre lettre de motivation et vos formations. ${agencyName} pourra continuer votre candidature.`}
        confirmLabel="Je valide"
        loading={busy}
        onConfirm={() => void approve()}
        onCancel={() => setConfirming(false)}
      />
      <RequestDialog open={requesting} agencyName={agencyName} onClose={() => setRequesting(false)} />
    </section>
  );
}
