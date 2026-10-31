"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  CircleCheck,
  Copy,
  Hourglass,
  Link2,
  Loader2,
  Lock,
  MessageSquareText,
  MoreHorizontal,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MENU_ITEM_CLASS, StatusPill } from "@/components/page-ui";
import { callApi } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  RowMenu,
  TRACK_INDENT,
  TrackRow,
  useHeaderTarget,
} from "@/features/cases/components/case-header";
import {
  WhatsAppAccessItem,
  type WhatsAppMenuContext,
} from "@/features/whatsapp/components/whatsapp-menu";
import type { ReviewStatus, StudentAccess } from "@/features/student/schemas";

type Action = "enable" | "disable" | "regenerate";

// Avis du candidat sur la lettre et les formations (dates déjà formatées)
type Review = { status: ReviewStatus; respondedLabel: string | null; lastRequest: string | null };

// Accès du candidat à son espace, dans l'en-tête du dossier : ouvrir ou
// fermer l'accès, transmettre le code (menu Partager), créer un nouveau code
// (menu « … »).
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
  review: Review;
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

  // Arrivée depuis le guide de démarrage : la ligne est montrée et soulignée
  const targeted = useHeaderTarget() === "espace-candidat";
  const rootRef = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState(targeted);
  useEffect(() => {
    if (!targeted) return;
    rootRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setGlow(false), 2500);
    return () => clearTimeout(t);
  }, [targeted]);

  return (
    <div
      ref={rootRef}
      id="espace-candidat"
      className={cn(
        "transition-colors duration-700",
        glow && "bg-highlight",
      )}
    >
      <TrackRow
        icon={UserRound}
        label="Espace candidat"
        actions={
          enabled ? (
            <>
              <RowMenu
                label="Transmettre le code au candidat"
                size="xs"
                trigger={
                  copied === "link" ? (
                    <>
                      <Check /> Message copié
                    </>
                  ) : (
                    <>
                      <Send /> Partager <ChevronDown />
                    </>
                  )
                }
              >
                {(close) => (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      className={cn(MENU_ITEM_CLASS, "flex items-center gap-2")}
                      onClick={() => {
                        close();
                        void copy("link");
                      }}
                    >
                      <Link2 className="size-4 text-muted-foreground" aria-hidden />
                      Copier le message avec le lien
                    </button>
                    {whatsapp.context.accessCode && (
                      <WhatsAppAccessItem
                        phone={whatsapp.phone}
                        context={whatsapp.context}
                        onSelect={close}
                      />
                    )}
                  </>
                )}
              </RowMenu>
              {!readOnly && (
                <RowMenu
                  label="Autres actions sur l'accès"
                  size="icon-xs"
                  trigger={<MoreHorizontal />}
                >
                  {(close) => (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={busy !== null}
                        className={cn(MENU_ITEM_CLASS, "flex items-center gap-2")}
                        onClick={() => {
                          close();
                          setConfirm("regenerate");
                        }}
                      >
                        <RefreshCw className="size-4 text-muted-foreground" aria-hidden />
                        Nouveau code
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={busy !== null}
                        className={cn(MENU_ITEM_CLASS, "flex items-center gap-2 text-destructive")}
                        onClick={() => {
                          close();
                          setConfirm("disable");
                        }}
                      >
                        <Lock className="size-4" aria-hidden />
                        Fermer l&apos;accès
                      </button>
                    </>
                  )}
                </RowMenu>
              )}
            </>
          ) : (
            !readOnly && (
              <Button variant="outline" size="xs" disabled={busy !== null}
                onClick={() => void run("enable")}>
                {busy === "enable" && <Loader2 className="animate-spin" aria-hidden />}
                {access ? "Rouvrir l'accès" : "Ouvrir l'accès"}
              </Button>
            )
          )
        }
      >
        {enabled ? (
          <>
            <StatusPill tone="ok">Ouvert</StatusPill>
            <span className="flex items-center gap-0.5">
              <code className="rounded-md bg-muted px-2 py-0.5 font-mono font-semibold tracking-wider">
                {access.code}
              </code>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => void copy("code")}
                aria-label="Copier le code"
                title="Copier le code"
              >
                {copied === "code" ? <Check /> : <Copy />}
              </Button>
            </span>
          </>
        ) : (
          <StatusPill tone="off">Fermé</StatusPill>
        )}
        {access && <ReviewPill review={review} />}
      </TrackRow>

      {/* Demande du candidat : à lire et à traiter, donc affichée en entier */}
      {access && review.status === "changes_requested" && (
        <div className={cn("pb-2.5 text-sm", TRACK_INDENT)}>
          {review.lastRequest && (
            <p className="border-l-2 border-amber-500/50 pl-2 whitespace-pre-wrap break-words text-muted-foreground">
              {review.lastRequest}
            </p>
          )}
          <Link
            href={`/cases/${caseId}/messages`}
            className="mt-1 inline-block text-sm font-medium text-link hover:underline"
          >
            Répondre au candidat →
          </Link>
        </div>
      )}

      {enabled && blockedReason && (
        <p className={cn("pb-2 text-xs text-muted-foreground", TRACK_INDENT)}>
          Le candidat ne peut pas se connecter : {blockedReason}.
        </p>
      )}

      {error && (
        <p className={cn("pb-2 text-sm text-destructive", TRACK_INDENT)} role="alert">
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

// Avis du candidat sur la lettre et les formations, en une pastille
function ReviewPill({ review }: { review: Review }) {
  const on = review.respondedLabel ? ` le ${review.respondedLabel}` : "";
  if (review.status === "approved") {
    return (
      <span title="Lettre et formations validées par le candidat" className="flex">
        <StatusPill tone="ok">
          <CircleCheck className="size-3.5" aria-hidden /> Validé{on}
        </StatusPill>
      </span>
    );
  }
  if (review.status === "changes_requested") {
    return (
      <StatusPill tone="warn">
        <MessageSquareText className="size-3.5" aria-hidden /> Modification demandée{on}
      </StatusPill>
    );
  }
  return (
    <span
      className="flex items-center gap-1 text-xs text-muted-foreground"
      title="Le candidat n'a pas encore donné son avis sur la lettre et les formations"
    >
      <Hourglass className="size-3.5" aria-hidden /> En attente de son avis
    </span>
  );
}
