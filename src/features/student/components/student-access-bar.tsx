"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CircleCheck,
  Copy,
  Hourglass,
  Link2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { callApi } from "@/lib/api-client";
import {
  WhatsAppAccessButton,
  type WhatsAppMenuContext,
} from "@/features/whatsapp/components/whatsapp-menu";
import type { ReviewStatus, StudentAccess } from "@/features/student/schemas";

type Action = "enable" | "disable" | "regenerate";

// Accès du candidat à son espace, dans l'en-tête du dossier : ouvrir ou
// fermer l'accès, copier le code ou le lien, créer un nouveau code.
export function StudentAccessBar({
  caseId,
  access,
  blockedReason,
  review,
  whatsapp,
  readOnly = false,
}: {
  caseId: string;
  // Envoi du code au candidat par WhatsApp
  whatsapp: { phone: string; context: WhatsAppMenuContext };
  // Abonnement expiré : plus d'ouverture, de fermeture ni de nouveau code
  readOnly?: boolean;
  access: StudentAccess;
  // Accès ouvert mais sans effet (dossier abandonné, campagne archivée)
  blockedReason: string | null;
  // Avis du candidat sur la lettre et les formations (dates déjà formatées)
  review: { status: ReviewStatus; respondedLabel: string | null; lastRequest: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(action);
    setError(null);
    const res = await callApi(`/api/cases/${caseId}/student-access`, {
      method: "PUT",
      body: { action },
    });
    setBusy(null);
    setConfirm(null);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  async function copy(what: "code" | "link") {
    if (!access) return;
    const link = `${window.location.origin}/student/login`;
    const text =
      what === "code"
        ? access.code
        : `Votre espace candidat : ${link}\nVotre code d'accès : ${access.code}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Copie impossible : copiez le code à la main.");
    }
  }

  const enabled = access?.enabled === true;

  return (
    <div className="mt-2 rounded-xl border bg-muted/40 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
        <span className="flex items-center gap-1.5 font-medium">
          <UserRound className="size-4 text-muted-foreground" aria-hidden />
          Espace candidat
        </span>

        {enabled ? (
          <>
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Ouvert
            </span>
            <code className="rounded-md bg-background px-2 py-0.5 font-mono font-semibold tracking-wider">
              {access.code}
            </code>
            <Button variant="ghost" size="xs" onClick={() => void copy("code")}>
              {copied === "code" ? <Check /> : <Copy />} Copier le code
            </Button>
            <Button variant="ghost" size="xs" onClick={() => void copy("link")}>
              {copied === "link" ? <Check /> : <Link2 />} Copier le message
            </Button>
            {whatsapp.context.accessCode && (
              <WhatsAppAccessButton phone={whatsapp.phone} context={whatsapp.context} />
            )}
          </>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            Fermé
          </span>
        )}

        {!readOnly && (
        <span className="ml-auto flex items-center gap-1">
          {enabled ? (
            <>
              <Button variant="ghost" size="xs" disabled={busy !== null}
                onClick={() => setConfirm("regenerate")}>
                <RefreshCw /> Nouveau code
              </Button>
              <Button variant="ghost" size="xs" disabled={busy !== null}
                onClick={() => setConfirm("disable")}>
                Fermer l&apos;accès
              </Button>
            </>
          ) : (
            <Button variant="outline" size="xs" disabled={busy !== null}
              onClick={() => void run("enable")}>
              {busy === "enable" && <Loader2 className="animate-spin" aria-hidden />}
              {access ? "Rouvrir l'accès" : "Ouvrir l'accès"}
            </Button>
          )}
        </span>
        )}
      </div>

      {access && (
        <div className="flex gap-2 border-t px-3 py-2 text-sm">
          {review.status === "approved" ? (
            <>
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <span>
                <span className="font-medium">Validé par le candidat</span>
                {review.respondedLabel && (
                  <span className="text-muted-foreground"> · le {review.respondedLabel}</span>
                )}
              </span>
            </>
          ) : review.status === "changes_requested" ? (
            <>
              <MessageSquareText className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <div className="min-w-0">
                <p>
                  <span className="font-medium">Modification demandée</span>
                  {review.respondedLabel && (
                    <span className="text-muted-foreground"> · le {review.respondedLabel}</span>
                  )}
                </p>
                {review.lastRequest && (
                  <p className="mt-1 border-l-2 border-amber-500/50 pl-2 whitespace-pre-wrap break-words text-muted-foreground">
                    {review.lastRequest}
                  </p>
                )}
                <Link
                  href={`/cases/${caseId}/messages`}
                  className="mt-1 inline-block text-sm font-medium text-primary hover:underline"
                >
                  Répondre au candidat →
                </Link>
              </div>
            </>
          ) : (
            <>
              <Hourglass className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">
                En attente de l&apos;avis du candidat sur la lettre et les formations
              </span>
            </>
          )}
        </div>
      )}

      {enabled && blockedReason && (
        <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          Le candidat ne peut pas se connecter : {blockedReason}.
        </p>
      )}

      {error && (
        <p className="border-t px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={confirm === "regenerate"}
        title="Créer un nouveau code ?"
        body="L'ancien code ne fonctionnera plus et le candidat sera déconnecté. Transmettez-lui le nouveau code."
        confirmLabel="Nouveau code"
        loading={busy !== null}
        onConfirm={() => void run("regenerate")}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "disable"}
        title="Fermer l'accès du candidat ?"
        body="Le candidat sera déconnecté et ne pourra plus consulter son espace. Vous pourrez rouvrir l'accès avec le même code."
        confirmLabel="Fermer l'accès"
        danger
        loading={busy !== null}
        onConfirm={() => void run("disable")}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
