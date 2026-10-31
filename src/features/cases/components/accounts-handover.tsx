"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Loader2, MessageCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useModalDialog } from "@/hooks/use-modal-dialog";
import { callApi } from "@/lib/api-client";
import { toWhatsAppNumber, whatsAppUrl } from "@/features/whatsapp/whatsapp";
import { handoverMessage, type HandoverAccount } from "../outlook";

// Fenêtre « Remettre au candidat » : ses comptes et leurs mots de passe dans
// un message à copier ou à envoyer par WhatsApp. Montée à l'ouverture et
// démontée à la fermeture : les mots de passe ne restent pas dans la page.
export function AccountsHandover({
  caseId,
  candidate,
  agencyName,
  phone,
  onClose,
}: {
  caseId: string;
  // Prénom du candidat
  candidate: string;
  agencyName: string;
  phone: string;
  onClose: () => void;
}) {
  const ref = useModalDialog(true);
  const textId = useId();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const number = toWhatsAppNumber(phone);

  // Une seule lecture (donc une seule ligne au journal), même quand React
  // relance l'effet en développement
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void callApi<{ accounts?: HandoverAccount[] }>(
      `/api/cases/${caseId}/external-accounts/handover`,
    ).then((res) => {
      if (!res.ok || !Array.isArray(res.data.accounts)) {
        setError(res.ok ? "Impossible de lire les comptes" : res.error);
        return;
      }
      setText(handoverMessage({ candidate, agencyName, accounts: res.data.accounts }));
    });
  }, [caseId, candidate, agencyName]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby={`${textId}-title`}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100%-2rem))] overflow-y-auto rounded-2xl border bg-card p-5 text-card-foreground backdrop:bg-black/45"
    >
      <h2 id={`${textId}-title`} className="text-base font-semibold">
        Remettre les comptes au candidat
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Ses identifiants et mots de passe, prêts à lui envoyer. Cet affichage est noté dans
        l&apos;historique.
      </p>

      <div className="mt-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : text === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Chargement des comptes…
          </p>
        ) : (
          <div className="space-y-1">
            <Label htmlFor={textId}>Message (modifiable)</Label>
            <textarea
              id={textId}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              spellCheck={false}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            {copyFailed && (
              <p className="text-sm text-destructive" role="alert">
                Copie impossible : sélectionnez le message et copiez-le à la main.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Fermer
        </Button>
        {text !== null && (
          <>
            {number && (
              <a
                href={whatsAppUrl(number, text)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline" })}
              >
                <MessageCircle className="text-emerald-700 dark:text-emerald-400" /> WhatsApp
              </a>
            )}
            <Button onClick={copy}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copié" : "Copier le message"}
            </Button>
          </>
        )}
      </div>
    </dialog>
  );
}
