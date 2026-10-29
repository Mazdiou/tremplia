"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MENU_ITEM_CLASS } from "@/components/page-ui";
import { Button } from "@/components/ui/button";
import { callApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useDismiss } from "@/hooks/use-dismiss";

// Saisie d'un nom de groupe sur une ligne de l'arbre (Entrée : valider,
// Échap : annuler). Renvoie un message d'erreur, ou null en cas de succès.
export function InlineNameInput({
  label,
  initial = "",
  onSubmit,
  onCancel,
}: {
  label: string;
  initial?: string;
  onSubmit: (name: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const failure = await onSubmit(name);
    setBusy(false);
    if (failure) setError(failure);
  }

  return (
    <form onSubmit={submit} className="mx-3 my-1 space-y-1 pl-5">
      <div className="flex items-center gap-1">
        <input
          aria-label={label}
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel()}
          className="h-7 min-w-0 flex-1 rounded-md border bg-card px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" size="icon-xs" variant="ghost" aria-label="Valider" disabled={busy}>
          <Check />
        </Button>
        <Button type="button" size="icon-xs" variant="ghost" aria-label="Annuler" onClick={onCancel}>
          <X />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

// Menu « … » d'une campagne dans l'arbre
export function CampaignMenu({
  campaignId,
  campaignName,
  active,
  onAddGroup,
}: {
  campaignId: string;
  campaignName: string;
  active: boolean;
  onAddGroup: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useDismiss(ref, open, setOpen);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Actions sur ${campaignName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <MoreHorizontal />
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute top-7 right-0 z-30 w-48 rounded-xl border bg-popover p-1 shadow-lg"
        >
          {active && (
            <Link role="menuitem" href={`/cases/new?campaign=${campaignId}`} className={MENU_ITEM_CLASS}>
              Nouveau dossier
            </Link>
          )}
          {active && (
            <button
              role="menuitem"
              type="button"
              className={MENU_ITEM_CLASS}
              onClick={() => {
                setOpen(false);
                onAddGroup();
              }}
            >
              Ajouter un groupe
            </button>
          )}
          <Link role="menuitem" href={`/campaigns/${campaignId}`} className={MENU_ITEM_CLASS}>
            Ouvrir la campagne
          </Link>
        </div>
      )}
    </div>
  );
}

// Boutons Renommer / Supprimer d'un groupe, visibles au survol ou au focus
export function GroupActions({
  campaignId,
  groupId,
  groupName,
  onRename,
  className,
}: {
  campaignId: string;
  groupId: string;
  groupName: string;
  onRename: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <span className={cn("flex items-center", className)}>
      <Button variant="ghost" size="icon-xs" aria-label={`Renommer ${groupName}`} onClick={onRename}>
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={`Supprimer ${groupName}`}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        <Trash2 />
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Supprimer le groupe « ${groupName} » ?`}
        body={
          error ??
          "Les dossiers ne sont pas supprimés, seulement retirés de ce groupe."
        }
        confirmLabel="Supprimer le groupe"
        danger
        loading={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setBusy(true);
          const failure = await callApiError(`/api/campaigns/${campaignId}/groups/${groupId}`, {
            method: "DELETE",
          });
          setBusy(false);
          if (failure) {
            setError(failure);
            return;
          }
          setConfirming(false);
          router.refresh();
        }}
      />
    </span>
  );
}

export const groupApi = {
  create: (campaignId: string, name: string) =>
    callApiError(`/api/campaigns/${campaignId}/groups`, { body: { name } }),
  rename: (campaignId: string, groupId: string, name: string) =>
    callApiError(`/api/campaigns/${campaignId}/groups/${groupId}`, {
      method: "PATCH",
      body: { name },
    }),
};
